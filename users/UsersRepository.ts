import { createClient } from '@supabase/supabase-js'
import type { IUsersRepository, User, CreateUserInput, UserWithMemberships, UserListFilters, UserListSort } from '@/users/users.types'
import { getCachedHasUsers, setCachedHasUsers } from '@/users/usersCache'

export class UsersRepository implements IUsersRepository {
  private readonly supabase
  /** Resolves once on the first successful schema check; rejects if the table is absent. */
  private schemaCheck: Promise<void> | null = null

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    this.supabase = createClient(url, key)
  }

  /**
   * Lazily verifies that `public.users` exists in the database.
   * The check is performed at most once per repository instance — subsequent
   * calls reuse the cached Promise so there is no repeated round-trip.
   *
   * Throws:
   *   Error: Supabase table "public.users" does not exist — run pending migrations before starting the application.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('users')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.users" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  private toUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      role: row.role as 'admin' | 'player',
      mustChangePassword: row.must_change_password as boolean,
      tokenVersion: (row.token_version as number) ?? 1,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  async findById(id: string): Promise<User | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return this.toUser(data)
  }

  async findByEmail(email: string): Promise<User | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
    if (error || !data) return null
    return this.toUser(data)
  }

  async setMustChangePassword(userId: string, value: boolean): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('users')
      .update({ must_change_password: value })
      .eq('id', userId)
    if (error) throw new Error(`setMustChangePassword failed: ${error.message}`)
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId)
    if (error) throw new Error(`setPasswordHash failed: ${error.message}`)
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase.rpc('increment_token_version', { p_user_id: userId })
    if (error) throw new Error(`incrementTokenVersion failed: ${error.message}`)
  }

  /**
   * Insert a new user row and return the mapped User.
   * Sets the hasUsers cache to `true` on success so subsequent
   * `hasAnyUser()` calls skip the DB entirely.
   */
  async create(input: CreateUserInput): Promise<User> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        email: input.email,
        password_hash: input.passwordHash,
        role: input.role,
        must_change_password: input.mustChangePassword ?? false,
      })
      .select('*')
      .single()
    if (error || !data) {
      throw new Error(`create failed: ${error?.message ?? 'no data returned'}`)
    }
    setCachedHasUsers(true)
    return this.toUser(data)
  }

  /**
   * List users with their memberships, applying server-side filters, sort, and pagination.
   *
   * Join strategy:
   * - LEFT JOIN quiniela_memberships on user_id
   * - LEFT JOIN quinielas on quiniela_id
   * - Filters: status (approved_at IS NULL / IS NOT NULL), quinielaId, search (ILIKE on email)
   * - Sort: email or name column, asc/desc
   * - Pagination: LIMIT / OFFSET
   * - Each returned user's memberships array contains ALL their memberships (unfiltered)
   *   so the frontend can show the full picture; the filter only narrows which users appear.
   */
  async listAll(
    filters: UserListFilters,
    pagination: { page: number; pageSize: number },
    sort: UserListSort,
  ): Promise<{ users: UserWithMemberships[]; total: number }> {
    await this.verifySchema()

    // --- Step 1: Determine the matching user IDs based on filters ---
    // We query quiniela_memberships for filtering, then fetch those users.

    // Build a membership subquery to find matching user IDs.
    // If no membership filters, we query all users.
    let matchingUserIds: string[] | null = null

    if (filters.status || filters.quinielaId) {
      let membershipQuery = this.supabase
        .from('quiniela_memberships')
        .select('user_id')

      if (filters.quinielaId) {
        membershipQuery = membershipQuery.eq('quiniela_id', filters.quinielaId)
      }

      if (filters.status === 'pending') {
        membershipQuery = membershipQuery.is('approved_at', null)
      } else if (filters.status === 'active') {
        membershipQuery = membershipQuery.not('approved_at', 'is', null)
      }

      const { data: membershipRows, error: membershipError } = await membershipQuery
      if (membershipError) throw new Error(`listAll membership filter failed: ${membershipError.message}`)

      matchingUserIds = (membershipRows ?? []).map((r: Record<string, unknown>) => r.user_id as string)

      // If no memberships match the filter, return early
      if (matchingUserIds.length === 0) {
        return { users: [], total: 0 }
      }
    }

    // --- Step 2: Query users with optional search and ID filter ---
    const sortColumn = sort.column === 'name' ? 'email' : 'email' // users table has no name column; fallback to email
    const ascending = sort.direction === 'asc'
    const { pageSize, page } = pagination
    const offset = (page - 1) * pageSize

    let usersQuery = this.supabase
      .from('users')
      .select('id, email, role', { count: 'exact' })
      .order(sortColumn, { ascending })
      .range(offset, offset + pageSize - 1)

    if (filters.search) {
      usersQuery = usersQuery.ilike('email', `%${filters.search}%`)
    }

    if (matchingUserIds !== null) {
      usersQuery = usersQuery.in('id', matchingUserIds)
    }

    const { data: usersData, count, error: usersError } = await usersQuery
    if (usersError) throw new Error(`listAll users query failed: ${usersError.message}`)

    const users = (usersData ?? []) as Array<{ id: string; email: string; role: string }>
    const total = count ?? 0

    if (users.length === 0) {
      return { users: [], total }
    }

    // --- Step 3: Fetch ALL memberships for the matched users (unfiltered) ---
    const userIds = users.map((u) => u.id)
    const { data: membershipsData, error: membershipsError } = await this.supabase
      .from('quiniela_memberships')
      .select('id, user_id, quiniela_id, role, approved_at, quinielas!inner(name)')
      .in('user_id', userIds)

    if (membershipsError) throw new Error(`listAll memberships fetch failed: ${membershipsError.message}`)

    type MembershipRow = { id: string; user_id: string; quiniela_id: string; role: string; approved_at: string | null; quinielas: { name: string } }
    const membershipRows = (membershipsData ?? []) as unknown as MembershipRow[]

    // Group memberships by user_id
    const membershipsByUser = new Map<string, typeof membershipRows>()
    for (const row of membershipRows) {
      const existing = membershipsByUser.get(row.user_id) ?? []
      existing.push(row)
      membershipsByUser.set(row.user_id, existing)
    }

    // --- Step 4: Assemble result ---
    const result: UserWithMemberships[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: null, // users table has no display name column
      memberships: (membershipsByUser.get(u.id) ?? []).map((m) => ({
        membershipId: m.id,
        quinielaId: m.quiniela_id,
        quinielaName: m.quinielas.name,
        role: m.role as 'admin' | 'member',
        approvedAt: m.approved_at ? new Date(m.approved_at) : null,
      })),
    }))

    return { users: result, total }
  }

  /**
   * Fetch a single user with all their quiniela memberships.
   * Returns null if no user with that ID exists.
   */
  async findByIdWithMemberships(userId: string): Promise<UserWithMemberships | null> {
    await this.verifySchema()

    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (userError || !userData) return null

    const user = userData as { id: string; email: string; role: string }

    const { data: membershipsData, error: membershipsError } = await this.supabase
      .from('quiniela_memberships')
      .select('id, quiniela_id, role, approved_at, quinielas!inner(name)')
      .eq('user_id', userId)

    if (membershipsError) throw new Error(`findByIdWithMemberships memberships fetch failed: ${membershipsError.message}`)

    type MRow = { id: string; quiniela_id: string; role: string; approved_at: string | null; quinielas: { name: string } }
    const rows = (membershipsData ?? []) as unknown as MRow[]

    return {
      id: user.id,
      email: user.email,
      name: null,
      memberships: rows.map((m) => ({
        membershipId: m.id,
        quinielaId: m.quiniela_id,
        quinielaName: m.quinielas.name,
        role: m.role as 'admin' | 'member',
        approvedAt: m.approved_at ? new Date(m.approved_at) : null,
      })),
    }
  }

  /**
   * Return `true` if at least one row exists in `public.users`.
   *
   * Uses the module-level cache to avoid repeated DB round-trips after the
   * first user is created (the most common runtime path).
   */
  async hasAnyUser(): Promise<boolean> {
    await this.verifySchema()

    // Fast path: if the cache already recorded that users exist, skip the DB.
    const cached = getCachedHasUsers()
    if (cached === true) return true

    const { data, error } = await this.supabase
      .from('users')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`hasAnyUser failed: ${error.message}`)

    const result = data !== null
    setCachedHasUsers(result)
    return result
  }
}
