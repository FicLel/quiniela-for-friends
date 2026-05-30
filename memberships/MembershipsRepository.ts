import { createClient } from '@supabase/supabase-js'
import type {
  IMembershipsRepository,
  Membership,
  MembershipRole,
  MemberWithUser,
} from '@/memberships/memberships.types'

export class MembershipsRepository implements IMembershipsRepository {
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
   * Lazily verifies that `public.quiniela_memberships` exists in the database.
   * The check is performed at most once per repository instance.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('quiniela_memberships')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.quiniela_memberships" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  private toMembership(row: Record<string, unknown>): Membership {
    return {
      id: row.id as string,
      quinielaId: row.quiniela_id as string,
      userId: row.user_id as string,
      role: row.role as MembershipRole,
      joinedAt: new Date(row.joined_at as string),
      approvedAt: row.approved_at ? new Date(row.approved_at as string) : null,
    }
  }

  async create(input: {
    quinielaId: string
    userId: string
    role: MembershipRole
  }): Promise<Membership> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_memberships')
      .insert({
        quiniela_id: input.quinielaId,
        user_id: input.userId,
        role: input.role,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`create membership failed: ${error?.message ?? 'no data returned'}`)
    }
    return this.toMembership(data as Record<string, unknown>)
  }

  async findById(membershipId: string): Promise<Membership | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_memberships')
      .select('*')
      .eq('id', membershipId)
      .single()
    if (error || !data) return null
    return this.toMembership(data as Record<string, unknown>)
  }

  async findByQuinielaAndUser(
    quinielaId: string,
    userId: string,
  ): Promise<Membership | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_memberships')
      .select('*')
      .eq('quiniela_id', quinielaId)
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    return this.toMembership(data as Record<string, unknown>)
  }

  async findAllByQuiniela(quinielaId: string): Promise<MemberWithUser[]> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_memberships')
      .select('*, users!inner(email)')
      .eq('quiniela_id', quinielaId)

    if (error) throw new Error(`findAllByQuiniela failed: ${error.message}`)
    if (!data) return []

    return (data as Record<string, unknown>[]).map((row) => {
      const users = row.users as Record<string, unknown>
      return {
        membershipId: row.id as string,
        quinielaId: row.quiniela_id as string,
        userId: row.user_id as string,
        email: users.email as string,
        role: row.role as MembershipRole,
        joinedAt: new Date(row.joined_at as string),
        approvedAt: row.approved_at ? new Date(row.approved_at as string) : null,
      }
    })
  }

  async approve(membershipId: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('quiniela_memberships')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', membershipId)
      .is('approved_at', null)
    if (error) throw new Error(`approve failed: ${error.message}`)
  }

  async deleteById(membershipId: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('quiniela_memberships')
      .delete()
      .eq('id', membershipId)
    if (error) throw new Error(`deleteById failed: ${error.message}`)
  }

  async countAdmins(quinielaId: string): Promise<number> {
    await this.verifySchema()
    const { count, error } = await this.supabase
      .from('quiniela_memberships')
      .select('id', { count: 'exact' })
      .eq('quiniela_id', quinielaId)
      .eq('role', 'admin')

    if (error) throw new Error(`countAdmins failed: ${error.message}`)
    return count ?? 0
  }
}
