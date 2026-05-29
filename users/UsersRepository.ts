import { createClient } from '@supabase/supabase-js'
import type { IUsersRepository, User, CreateUserInput } from '@/users/users.types'
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
