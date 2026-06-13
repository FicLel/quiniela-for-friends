/**
 * PredictionScoreRepository — Infrastructure adapter for public.prediction_scores table.
 *
 * Implements IPredictionScoreRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as CompetitionsRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { getSupabaseServerClient } from '@/lib/supabaseServerClient'
import { verifyTableOnce } from '@/lib/schemaCheckCache'
import { TtlCache } from '@/lib/ttlCache'
import type {
  IPredictionScoreRepository,
  PlayerPredictionEntry,
  PredictionScore,
  PredictionWithQuiniela,
} from '@/scoring/scoring.types'

/**
 * Process-scoped caches for findPlayerPredictionsForViewer, keyed by
 * `${quinielaId}:${viewerUserId}` — viewerUserId is always the subject whose
 * data is being read (the impersonated user's ID when an admin is
 * impersonating, or the caller's own session.sub otherwise). Because the key
 * is keyed by the subject (not the caller), admin-own-reads and
 * impersonated-reads naturally land in different keys with zero
 * special-casing, and a regular session for user A and an impersonated
 * session for user A share the same (correct) cache entry.
 *
 * Two instances, per Decision B:
 * - `playerPredictionsCache`             — 30s TTL for normal reads.
 * - `impersonatedPlayerPredictionsCache` — 5s TTL for impersonated reads, so
 *   an admin debugging "my picks didn't save" sees near-real-time data.
 *
 * TtlCache's TTL is fixed at construction (no per-call override), hence two
 * instances rather than one.
 */
const playerPredictionsCache = new TtlCache<PlayerPredictionEntry[]>(30_000, 200)
const impersonatedPlayerPredictionsCache = new TtlCache<PlayerPredictionEntry[]>(5_000, 200)

/** Clear both player-predictions caches — intended for tests only. */
export function resetPlayerPredictionsCache(): void {
  playerPredictionsCache.clear()
  impersonatedPlayerPredictionsCache.clear()
}

export class PredictionScoreRepository implements IPredictionScoreRepository {
  private readonly supabase

  constructor() {
    this.supabase = getSupabaseServerClient()
  }

  /**
   * Lazily verifies that `public.prediction_scores` exists in the database.
   * The check is performed at most once per server process.
   */
  private verifySchema(): Promise<void> {
    return verifyTableOnce('prediction_scores', async () => {
      const { error } = await this.supabase
        .from('prediction_scores')
        .select('id')
        .limit(0)

      if (error) {
        throw new Error(
          'Supabase table "public.prediction_scores" does not exist — run pending migrations before starting the application.',
        )
      }
    })
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
      homeGoalPoints: number
      awayGoalPoints: number
      outcomePoints: number
      extraQuestionPoints: number
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
      homeGoalPoints: number
      awayGoalPoints: number
      outcomePoints: number
      extraQuestionPoints: number
    }>()

    for (const row of (data ?? []) as unknown as ScoreRow[]) {
      const userId = row.user_expected_results.user_id
      const existing = byUser.get(userId) ?? {
        userId,
        totalPoints: 0,
        exactScoreHits: 0,
        correctOutcomeHits: 0,
        predictedMatchCount: 0,
        homeGoalPoints: 0,
        awayGoalPoints: 0,
        outcomePoints: 0,
        extraQuestionPoints: 0,
      }

      existing.totalPoints += row.total_points
      existing.predictedMatchCount += 1
      existing.homeGoalPoints += row.home_goal_point ?? 0
      existing.awayGoalPoints += row.away_goal_point ?? 0
      existing.outcomePoints += row.outcome_point ?? 0

      if (row.home_goal_point === 1 && row.away_goal_point === 1) {
        existing.exactScoreHits += 1
      }
      if (row.outcome_point === 1) {
        existing.correctOutcomeHits += 1
      }

      byUser.set(userId, existing)
    }

    // Fetch extra question results for the quiniela and merge into byUser
    const { data: extraData, error: extraError } = await this.supabase
      .from('extra_question_results')
      .select('user_id, points')
      .eq('quiniela_id', quinielaId)

    if (extraError) {
      throw new Error(`aggregateByQuiniela extra_question_results failed: ${extraError.message}`)
    }

    for (const row of (extraData ?? []) as { user_id: string; points: number }[]) {
      const existing = byUser.get(row.user_id)
      if (existing) {
        existing.totalPoints += row.points
        existing.extraQuestionPoints += row.points
      } else {
        byUser.set(row.user_id, {
          userId: row.user_id,
          totalPoints: row.points,
          exactScoreHits: 0,
          correctOutcomeHits: 0,
          predictedMatchCount: 0,
          homeGoalPoints: 0,
          awayGoalPoints: 0,
          outcomePoints: 0,
          extraQuestionPoints: row.points,
        })
      }
    }

    return Array.from(byUser.values())
  }

  /**
   * Return all scored match predictions for a specific player in a quiniela.
   * Only includes entries for FINISHED matches with non-null regulation goals.
   *
   * Two-step query pattern:
   *   1. Fetch prediction_scores for (quiniela_id, user_id), joined with user_expected_results.
   *   2. Fetch the distinct matches referenced by step 1.
   *   3. In-memory: filter to FINISHED matches with non-null goals, then map to PlayerPredictionEntry.
   *
   * Throws on Supabase error.
   */
  async findPlayerPredictionsForViewer(
    quinielaId: string,
    userId: string,
    options?: { isImpersonating?: boolean },
  ): Promise<PlayerPredictionEntry[]> {
    const cache = options?.isImpersonating
      ? impersonatedPlayerPredictionsCache
      : playerPredictionsCache
    const cacheKey = `${quinielaId}:${userId}`

    const cached = cache.get(cacheKey)
    if (cached) return cached

    await this.verifySchema()

    // Step 1: fetch prediction_scores for the (quiniela_id, user_id) pair
    const { data: predictionRows, error: predError } = await this.supabase
      .from('prediction_scores')
      .select(`
        home_goal_point,
        away_goal_point,
        outcome_point,
        total_points,
        user_expected_results!inner(
          home_score,
          away_score,
          match_id,
          user_id
        )
      `)
      .eq('quiniela_id', quinielaId)
      .eq('user_expected_results.user_id', userId)

    if (predError) {
      throw new Error(`findPlayerPredictionsForViewer failed: ${predError.message}`)
    }

    if (!predictionRows || predictionRows.length === 0) {
      cache.set(cacheKey, [])
      return []
    }

    type PredRow = {
      home_goal_point: number
      away_goal_point: number
      outcome_point: number
      total_points: number
      user_expected_results: {
        home_score: number
        away_score: number
        match_id: string
        user_id: string
      }
    }

    const typedPredRows = predictionRows as unknown as PredRow[]

    // Step 2: fetch the distinct matches referenced by those prediction rows
    const matchIds = [...new Set(typedPredRows.map((r) => r.user_expected_results.match_id))]
    const { data: matchRows, error: matchError } = await this.supabase
      .from('matches')
      .select('id, home_team_name, away_team_name, scheduled_at, status, regulation_home_goals, regulation_away_goals')
      .in('id', matchIds)

    if (matchError) {
      throw new Error(`findPlayerPredictionsForViewer matches fetch failed: ${matchError.message}`)
    }

    type MatchRow = {
      id: string
      home_team_name: string
      away_team_name: string
      scheduled_at: string
      status: string
      regulation_home_goals: number | null
      regulation_away_goals: number | null
    }

    // Step 3: build match lookup map, filter to FINISHED with non-null goals, map to PlayerPredictionEntry
    const matchMap = new Map<string, MatchRow>()
    for (const m of (matchRows ?? []) as unknown as MatchRow[]) {
      matchMap.set(m.id, m)
    }

    const results: PlayerPredictionEntry[] = []

    for (const predRow of typedPredRows) {
      const match = matchMap.get(predRow.user_expected_results.match_id)
      if (!match) continue
      if (match.status !== 'FINISHED') continue
      if (match.regulation_home_goals === null || match.regulation_away_goals === null) continue

      results.push({
        matchId: match.id,
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
        scheduledAt: match.scheduled_at,
        predictedHomeScore: predRow.user_expected_results.home_score,
        predictedAwayScore: predRow.user_expected_results.away_score,
        regulationHomeGoals: match.regulation_home_goals,
        regulationAwayGoals: match.regulation_away_goals,
        homeGoalPoint: predRow.home_goal_point as 0 | 1,
        awayGoalPoint: predRow.away_goal_point as 0 | 1,
        outcomePoint: predRow.outcome_point as 0 | 1,
        totalPoints: predRow.total_points as 0 | 1 | 2 | 3,
      })
    }

    cache.set(cacheKey, results)
    return results
  }

  /**
   * Invalidate the cached findPlayerPredictionsForViewer entry (both the
   * normal and impersonated caches) for the given (quinielaId, userId) pair.
   */
  invalidatePlayerPredictionsCache(quinielaId: string, userId: string): void {
    const cacheKey = `${quinielaId}:${userId}`
    playerPredictionsCache.invalidate(cacheKey)
    impersonatedPlayerPredictionsCache.invalidate(cacheKey)
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

  /**
   * Return all (homeScore, awayScore) crowd predictions for a set of matches,
   * grouped by match id, using a single query.
   * Used by ScoringService.getCrowdPercentagesForMatches.
   * Matches with no predictions are absent from the returned map.
   * Throws on Supabase error.
   */
  async findCrowdOutcomesByMatchIds(
    matchIds: string[],
  ): Promise<Map<string, { homeScore: number; awayScore: number }[]>> {
    const grouped = new Map<string, { homeScore: number; awayScore: number }[]>()
    if (matchIds.length === 0) return grouped

    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('user_expected_results')
      .select('match_id, home_score, away_score')
      .in('match_id', matchIds)

    if (error) {
      throw new Error(`findCrowdOutcomesByMatchIds failed: ${error.message}`)
    }

    for (const row of (data ?? []) as { match_id: string; home_score: number; away_score: number }[]) {
      const outcomes = grouped.get(row.match_id) ?? []
      outcomes.push({ homeScore: row.home_score, awayScore: row.away_score })
      grouped.set(row.match_id, outcomes)
    }

    return grouped
  }
}
