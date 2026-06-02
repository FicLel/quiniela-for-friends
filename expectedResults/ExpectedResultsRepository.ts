/**
 * ExpectedResultsRepository — Infrastructure adapter for public.user_expected_results table.
 *
 * Implements IExpectedResultsRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as MembershipsRepository
 * and CompetitionsRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  IExpectedResultsRepository,
  ExpectedResult,
  UpsertExpectedResultInput,
} from '@/expectedResults/expectedResults.types'

export class ExpectedResultsRepository implements IExpectedResultsRepository {
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
   * Lazily verifies that `public.user_expected_results` exists in the database.
   * The check is performed at most once per repository instance.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('user_expected_results')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.user_expected_results" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  private toExpectedResult(row: Record<string, unknown>): ExpectedResult {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      matchId: row.match_id as string,
      quinielaId: (row.quiniela_id as string | null | undefined) ?? null,
      homeScore: row.home_score as number,
      awayScore: row.away_score as number,
      lockedAt: row.locked_at ? new Date(row.locked_at as string) : null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Insert or update a prediction row keyed on:
   *   - (user_id, match_id) when quinielaId is null/undefined (shared mode)
   *   - (user_id, match_id, quiniela_id) when quinielaId is set (per-quiniela mode)
   *
   * On first insert, sets submitted_at = NOW().
   * On subsequent updates, submitted_at is preserved (not overwritten).
   * locked_at is never set here — it is managed by external admin processes.
   *
   * Throws on Supabase error.
   */
  async upsert(input: UpsertExpectedResultInput): Promise<void> {
    await this.verifySchema()

    const hasQuiniela = input.quinielaId != null

    // Build the pre-check query to determine insert vs. update
    let preCheckQuery = this.supabase
      .from('user_expected_results')
      .select('id, submitted_at')
      .eq('user_id', input.userId)
      .eq('match_id', input.matchId)

    if (hasQuiniela) {
      preCheckQuery = preCheckQuery.eq('quiniela_id', input.quinielaId as string)
    } else {
      preCheckQuery = preCheckQuery.is('quiniela_id', null)
    }

    const { data: existing } = await preCheckQuery.maybeSingle()

    const isFirstInsert = !existing

    const row: Record<string, unknown> = {
      user_id: input.userId,
      match_id: input.matchId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      quiniela_id: input.quinielaId ?? null,
    }

    if (isFirstInsert) {
      row.submitted_at = new Date().toISOString()
    }

    // Use the appropriate conflict target based on whether quiniela_id is set.
    // For shared rows (quiniela_id IS NULL), the partial unique index
    // (user_id, match_id) WHERE quiniela_id IS NULL handles deduplication —
    // Supabase upsert requires a named constraint, so we fall back to INSERT ... ON CONFLICT DO UPDATE
    // via the composite constraint for per-quiniela rows.
    const onConflict = hasQuiniela
      ? 'user_id,match_id,quiniela_id'
      : 'user_id,match_id'

    const { error } = await this.supabase
      .from('user_expected_results')
      .upsert(row, { onConflict })

    if (error) {
      throw new Error(`upsert expected result failed: ${error.message}`)
    }
  }

  /**
   * Return all predictions for a given user.
   * Returns [] if no rows exist.
   * Throws on Supabase error.
   */
  async findByUserId(userId: string): Promise<ExpectedResult[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('user_expected_results')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`findByUserId failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toExpectedResult(row))
  }

  /**
   * Delete all prediction rows for a given user.
   * No-op if the user has no predictions.
   * Throws on Supabase error.
   */
  async deleteByUserId(userId: string): Promise<void> {
    await this.verifySchema()

    const { error } = await this.supabase
      .from('user_expected_results')
      .delete()
      .eq('user_id', userId)

    if (error) {
      throw new Error(`deleteByUserId failed: ${error.message}`)
    }
  }

  /**
   * Return all predictions for a given match.
   * Returns [] if no rows exist.
   * Throws on Supabase error.
   */
  async findByMatchId(matchId: string): Promise<ExpectedResult[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('user_expected_results')
      .select('*')
      .eq('match_id', matchId)

    if (error) {
      throw new Error(`findByMatchId failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toExpectedResult(row))
  }

  /**
   * Return all predictions for a given user scoped to a quiniela.
   * Pass quinielaId = null to retrieve shared (NULL quiniela_id) predictions.
   * Returns [] if no rows exist.
   * Throws on Supabase error.
   */
  async findByUserIdAndQuiniela(userId: string, quinielaId: string | null): Promise<ExpectedResult[]> {
    await this.verifySchema()

    let query = this.supabase
      .from('user_expected_results')
      .select('*')
      .eq('user_id', userId)

    if (quinielaId !== null) {
      query = query.eq('quiniela_id', quinielaId)
    } else {
      query = query.is('quiniela_id', null)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`findByUserIdAndQuiniela failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toExpectedResult(row))
  }
}
