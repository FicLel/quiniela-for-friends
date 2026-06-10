import { getSupabaseServerClient } from '@/lib/supabaseServerClient'
import { verifyTableOnce } from '@/lib/schemaCheckCache'
import type { IInvitationsRepository, Invitation } from '@/invitations/invitations.types'

export class InvitationsRepository implements IInvitationsRepository {
  private readonly supabase

  constructor() {
    this.supabase = getSupabaseServerClient()
  }

  /**
   * Lazily verifies that `public.quiniela_invitations` exists in the database.
   * The check is performed at most once per server process.
   */
  private verifySchema(): Promise<void> {
    return verifyTableOnce('quiniela_invitations', async () => {
      const { error } = await this.supabase
        .from('quiniela_invitations')
        .select('id')
        .limit(0)

      if (error) {
        throw new Error(
          'Supabase table "public.quiniela_invitations" does not exist — run pending migrations before starting the application.',
        )
      }
    })
  }

  private toInvitation(row: Record<string, unknown>): Invitation {
    return {
      id: row.id as string,
      quinielaId: row.quiniela_id as string,
      email: row.email != null ? (row.email as string) : null,
      roleToAssign: row.role_to_assign as 'admin' | 'member',
      tokenHash: row.token_hash as string,
      shortCode: row.short_code as string,
      expiresAt: new Date(row.expires_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
      createdAt: new Date(row.created_at as string),
    }
  }

  async create(input: {
    quinielaId: string
    email: string | null
    roleToAssign: 'admin' | 'member'
    tokenHash: string
    shortCode: string
    expiresAt: Date
  }): Promise<Invitation> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .insert({
        quiniela_id: input.quinielaId,
        email: input.email ?? null,
        role_to_assign: input.roleToAssign,
        token_hash: input.tokenHash,
        short_code: input.shortCode,
        expires_at: input.expiresAt.toISOString(),
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`create invitation failed: ${error?.message ?? 'no data returned'}`)
    }
    return this.toInvitation(data as Record<string, unknown>)
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .single()
    if (error || !data) return null
    return this.toInvitation(data as Record<string, unknown>)
  }

  async findByShortCode(shortCode: string): Promise<Invitation | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .select('*')
      .eq('short_code', shortCode)
      .single()
    if (error || !data) return null
    return this.toInvitation(data as Record<string, unknown>)
  }

  /**
   * Find active (not accepted, not revoked, not expired) invitations
   * for a given email+quiniela combination.
   */
  async findActiveByEmailAndQuiniela(
    email: string,
    quinielaId: string,
  ): Promise<Invitation[]> {
    await this.verifySchema()
    const now = new Date().toISOString()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .select('*')
      .eq('email', email)
      .eq('quiniela_id', quinielaId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)

    if (error) throw new Error(`findActiveByEmailAndQuiniela failed: ${error.message}`)
    if (!data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toInvitation(row))
  }

  /**
   * Find the single active open (email=NULL) invitation for a quiniela.
   * Returns null if no active open invite exists.
   */
  async findActiveOpenByQuiniela(quinielaId: string): Promise<Invitation | null> {
    await this.verifySchema()
    const now = new Date().toISOString()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .select('*')
      .eq('quiniela_id', quinielaId)
      .is('email', null)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .limit(1)
      .single()

    if (error || !data) return null
    return this.toInvitation(data as Record<string, unknown>)
  }

  async markAccepted(invitationId: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('quiniela_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitationId)
    if (error) throw new Error(`markAccepted failed: ${error.message}`)
  }

  async markRevoked(invitationId: string): Promise<void> {
    await this.verifySchema()
    const { error } = await this.supabase
      .from('quiniela_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invitationId)
    if (error) throw new Error(`markRevoked failed: ${error.message}`)
  }

  async findAllByQuiniela(quinielaId: string): Promise<Invitation[]> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quiniela_invitations')
      .select('*')
      .eq('quiniela_id', quinielaId)

    if (error) throw new Error(`findAllByQuiniela failed: ${error.message}`)
    if (!data) return []
    return (data as Record<string, unknown>[]).map((row) => this.toInvitation(row))
  }
}
