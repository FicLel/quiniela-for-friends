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
   * Strategy:
   * - Join user_expected_results with quiniela_memberships on user_id.
   * - Filter by match_id and approved_at IS NOT NULL.
   * - Returns PredictionWithQuiniela[].
   *
   * Throws on Supabase error.
   */
  async findPredictionsWithQuinielas(matchId: string): Promise<PredictionWithQuiniela[]> {
    await this.verifySchema()

    // user_expected_results joined with quiniela_memberships via user_id
    const { data, error } = await this.supabase
      .from('user_expected_results')
      .select(`
        id,
        user_id,
        home_score,
        away_score,
        quiniela_memberships!inner(quiniela_id, approved_at)
      `)
      .eq('match_id', matchId)
      .not('quiniela_memberships.approved_at', 'is', null)

    if (error) {
      throw new Error(`findPredictionsWithQuinielas failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    type Row = {
      id: string
      user_id: string
      home_score: number
      away_score: number
      quiniela_memberships: { quiniela_id: string; approved_at: string | null }[]
    }

    const results: PredictionWithQuiniela[] = []
    for (const row of data as unknown as Row[]) {
      const memberships = Array.isArray(row.quiniela_memberships)
        ? row.quiniela_memberships
        : [row.quiniela_memberships]

      for (const membership of memberships) {
        if (membership.approved_at !== null) {
          results.push({
            predictionId: row.id,
            userId: row.user_id,
            homeScore: row.home_score,
            awayScore: row.away_score,
            quinielaId: membership.quiniela_id,
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
