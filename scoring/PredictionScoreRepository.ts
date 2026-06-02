/**
 * PredictionScoreRepository — Infrastructure adapter for public.prediction_scores table.
 *
 * Implements IPredictionScoreRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as CompetitionsRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  IPredictionScoreRepository,
  PredictionScore,
  PredictionWithQuiniela,
} from '@/scoring/scoring.types'

export class PredictionScoreRepository implements IPredictionScoreRepository {
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
   * Lazily verifies that `public.prediction_scores` exists in the database.
   * The check is performed at most once per repository instance.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('prediction_scores')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.prediction_scores" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  /**
   * Insert or update prediction_scores rows keyed on (prediction_id, quiniela_id).
   * No-op when rows is empty.
   * Throws on Supabase error.
   */
  async upsertBatch(rows: Omit<PredictionScore, 'id' | 'scoredAt'>[]): Promise<void> {
    if (rows.length === 0) return

    await this.verifySchema()

    const dbRows = rows.map((r) => ({
      prediction_id: r.predictionId,
      quiniela_id: r.quinielaId,
      home_goal_point: r.homeGoalPoint,
      away_goal_point: r.awayGoalPoint,
      outcome_point: r.outcomePoint,
      total_points: r.totalPoints,
    }))

    const { error } = await this.supabase
      .from('prediction_scores')
      .upsert(dbRows, { onConflict: 'prediction_id,quiniela_id', ignoreDuplicates: false })

    if (error) {
      throw new Error(`upsertBatch prediction_scores failed: ${error.message}`)
    }
  }

  /**
   * Return all predictions (with their quiniela context) for a given match.
   *
   * Routing strategy based on per-quiniela mode:
   * - Rows with quiniela_id set → score ONLY against that specific quiniela.
   *   These are per-quiniela predictions; they do not fan out.
   * - Rows with quiniela_id IS NULL → fan out across ALL quinielas the user
   *   is an approved member of (existing shared-mode behaviour).
   *
   * Both cases require the user to have at least one approved membership
   * (approved_at IS NOT NULL) to be included in scoring.
   *
   * Uses two separate Supabase queries (no PostgREST join) because there is no
   * FK between user_expected_results and quiniela_memberships:
   *   1. Fetch all prediction rows for the match.
   *   2. For per-quiniela rows: yield (predictionId, quiniela_id) directly.
   *   3. For shared rows: fetch approved memberships for the user, then fan out.
   *
   * Throws on Supabase error.
   */
  async findPredictionsWithQuinielas(matchId: string): Promise<PredictionWithQuiniela[]> {
    await this.verifySchema()

    // Step 1: Fetch all predictions for the match
    const { data: predictions, error: predictionsError } = await this.supabase
      .from('user_expected_results')
      .select('id, user_id, home_score, away_score, quiniela_id')
      .eq('match_id', matchId)

    if (predictionsError) {
      throw new Error(`findPredictionsWithQuinielas failed: ${predictionsError.message}`)
    }

    if (!predictions || predictions.length === 0) return []

    type PredictionRow = {
      id: string
      user_id: string
      home_score: number
      away_score: number
      quiniela_id: string | null
    }

    const rows = predictions as unknown as PredictionRow[]

    // Separate per-quiniela rows (quiniela_id set) from shared rows (quiniela_id IS NULL)
    const perQuinielaRows = rows.filter((r) => r.quiniela_id !== null)
    const sharedRows = rows.filter((r) => r.quiniela_id === null)

    const results: PredictionWithQuiniela[] = []

    // Step 2: Per-quiniela predictions — yield directly, no fan-out needed
    for (const row of perQuinielaRows) {
      results.push({
        predictionId: row.id,
        userId: row.user_id,
        homeScore: row.home_score,
        awayScore: row.away_score,
        quinielaId: row.quiniela_id as string,
      })
    }

    // Step 3: Shared predictions — fan out across all approved memberships for each user
    if (sharedRows.length > 0) {
      // Collect distinct user IDs among shared predictions
      const userIds = Array.from(new Set(sharedRows.map((r) => r.user_id)))

      // Fetch all approved memberships for these users in one query
      const { data: memberships, error: membershipsError } = await this.supabase
        .from('quiniela_memberships')
        .select('user_id, quiniela_id')
        .in('user_id', userIds)
        .not('approved_at', 'is', null)

      if (membershipsError) {
        throw new Error(`findPredictionsWithQuinielas memberships fetch failed: ${membershipsError.message}`)
      }

      type MembershipRow = { user_id: string; quiniela_id: string }
      const membershipRows = (memberships ?? []) as unknown as MembershipRow[]

      // Build a map: userId → quiniela_id[]
      const userQuinielaMap = new Map<string, string[]>()
      for (const m of membershipRows) {
        const existing = userQuinielaMap.get(m.user_id) ?? []
        existing.push(m.quiniela_id)
        userQuinielaMap.set(m.user_id, existing)
      }

      // Fan out each shared prediction across the user's approved quinielas
      for (const row of sharedRows) {
        const quinielaIds = userQuinielaMap.get(row.user_id) ?? []
        for (const quinielaId of quinielaIds) {
          results.push({
            predictionId: row.id,
            userId: row.user_id,
            homeScore: row.home_score,
            awayScore: row.away_score,
            quinielaId,
          })
        }
      }
    }

    return results
  }

  /**
   * Aggregate prediction_scores by user for a given quiniela.
   * Returns one aggregated row per user.
   * Throws on Supabase error.
   */
  async aggregateByQuiniela(quinielaId: string): Promise<
    {
      userId: string
      totalPoints: number
      exactScoreHits: number
      correctOutcomeHits: number
      predictedMatchCount: number
    }[]
  > {
    await this.verifySchema()

    // Join prediction_scores with user_expected_results to get user_id
    const { data, error } = await this.supabase
      .from('prediction_scores')
      .select(`
        total_points,
        home_goal_point,
        away_goal_point,
        outcome_point,
        user_expected_results!inner(user_id)
      `)
      .eq('quiniela_id', quinielaId)

    if (error) {
      throw new Error(`aggregateByQuiniela failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    type ScoreRow = {
      total_points: number
      home_goal_point: number
      away_goal_point: number
      outcome_point: number
      user_expected_results: { user_id: string }
    }

    // Aggregate in-memory by user_id
    const byUser = new Map<string, {
      userId: string
      totalPoints: number
      exactScoreHits: number
      correctOutcomeHits: number
      predictedMatchCount: number
    }>()

    for (const row of data as unknown as ScoreRow[]) {
      const userId = row.user_expected_results.user_id
      const existing = byUser.get(userId) ?? {
        userId,
        totalPoints: 0,
        exactScoreHits: 0,
        correctOutcomeHits: 0,
        predictedMatchCount: 0,
      }

      existing.totalPoints += row.total_points
      existing.predictedMatchCount += 1

      if (row.home_goal_point === 1 && row.away_goal_point === 1) {
        existing.exactScoreHits += 1
      }
      if (row.outcome_point === 1) {
        existing.correctOutcomeHits += 1
      }

      byUser.set(userId, existing)
    }

    return Array.from(byUser.values())
  }

  /**
   * Return all (homeScore, awayScore) crowd predictions for a match.
   * Used by ScoringService.getCrowdPercentages.
   * Throws on Supabase error.
   */
  async findCrowdOutcomes(matchId: string): Promise<{ homeScore: number; awayScore: number }[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('user_expected_results')
      .select('home_score, away_score')
      .eq('match_id', matchId)

    if (error) {
      throw new Error(`findCrowdOutcomes failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as { home_score: number; away_score: number }[]).map((row) => ({
      homeScore: row.home_score,
      awayScore: row.away_score,
    }))
  }
}
