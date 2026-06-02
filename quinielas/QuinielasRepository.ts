import { createClient } from '@supabase/supabase-js'
import type { IQuinielasRepository, Quiniela } from '@/quinielas/quinielas.types'

export class QuinielasRepository implements IQuinielasRepository {
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
   * Lazily verifies that `public.quinielas` exists in the database.
   * The check is performed at most once per repository instance.
   *
   * Throws:
   *   Error: Supabase table "public.quinielas" does not exist — run pending migrations before starting the application.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('quinielas')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.quinielas" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  private toQuiniela(row: Record<string, unknown>): Quiniela {
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Atomically creates a quiniela row and an admin membership row
   * via the `create_quiniela_with_admin` RPC function.
   * Returns the newly created quiniela.
   */
  async createWithAdmin(name: string, userId: string): Promise<Quiniela> {
    await this.verifySchema()

    const { data: quinielaId, error: rpcError } = await this.supabase
      .rpc('create_quiniela_with_admin', { p_name: name, p_user_id: userId })

    if (rpcError || !quinielaId) {
      throw new Error(`createWithAdmin RPC failed: ${rpcError?.message ?? 'no id returned'}`)
    }

    const { data, error } = await this.supabase
      .from('quinielas')
      .select('*')
      .eq('id', quinielaId as string)
      .single()

    if (error || !data) {
      throw new Error(`createWithAdmin fetch failed: ${error?.message ?? 'no data returned'}`)
    }

    return this.toQuiniela(data as Record<string, unknown>)
  }

  async findById(id: string): Promise<Quiniela | null> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quinielas')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return this.toQuiniela(data as Record<string, unknown>)
  }

  async findAllForUser(userId: string): Promise<Quiniela[]> {
    await this.verifySchema()
    const { data, error } = await this.supabase
      .from('quinielas')
      .select('*, quiniela_memberships!inner(user_id, approved_at)')
      .eq('quiniela_memberships.user_id', userId)
      .not('quiniela_memberships.approved_at', 'is', null)

    if (error) throw new Error(`findAllForUser failed: ${error.message}`)
    if (!data) return []

    return (data as Record<string, unknown>[]).map((row) => this.toQuiniela(row))
  }
}
