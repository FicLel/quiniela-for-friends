import { getSupabaseServerClient } from '@/lib/supabaseServerClient'
import { verifyTableOnce } from '@/lib/schemaCheckCache'

export interface IPasswordResetRepository {
  createToken(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
    createdBy: string
  }): Promise<{ id: string }>

  findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null>

  markUsed(tokenId: string): Promise<void>
}

export class PasswordResetRepository implements IPasswordResetRepository {
  private readonly supabase

  constructor() {
    this.supabase = getSupabaseServerClient()
  }

  private verifySchema(): Promise<void> {
    return verifyTableOnce('password_reset_tokens', async () => {
      const { error } = await this.supabase
        .from('password_reset_tokens')
        .select('id')
        .limit(0)

      if (error) {
        throw new Error(
          'Supabase table "public.password_reset_tokens" does not exist — run pending migrations before starting the application.',
        )
      }
    })
  }

  async createToken(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
    createdBy: string
  }): Promise<{ id: string }> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('password_reset_tokens')
      .insert({
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt.toISOString(),
        created_by: input.createdBy,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create password reset token: ${error?.message}`)
    }

    return { id: data.id as string }
  }

  async findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('password_reset_tokens')
      .select('id, user_id')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to look up password reset token: ${error.message}`)
    }

    if (!data) return null

    return { id: data.id as string, userId: data.user_id as string }
  }

  async markUsed(tokenId: string): Promise<void> {
    await this.verifySchema()

    const { error } = await this.supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenId)

    if (error) {
      throw new Error(`Failed to mark password reset token as used: ${error.message}`)
    }
  }
}
