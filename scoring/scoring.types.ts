/**
 * scoring.types.ts — Domain types, DTOs, and port interfaces for the
 * scoring module (three-point match prediction scoring and leaderboard).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type PredictionScore = {
  id: string
  predictionId: string
  quinielaId: string
  homeGoalPoint: 0 | 1
  awayGoalPoint: 0 | 1
  outcomePoint: 0 | 1
  totalPoints: 0 | 1 | 2 | 3
  scoredAt: Date
}

/** Breakdown of points awarded for a single prediction against a match result. */
export type ScoreBreakdown = {
  homeGoalPoint: 0 | 1
  awayGoalPoint: 0 | 1
  outcomePoint: 0 | 1
  totalPoints: 0 | 1 | 2 | 3
}

/** A single row in the quiniela leaderboard, ranked by total points. */
export type LeaderboardRow = {
  rank: number
  userId: string
  email: string
  totalPoints: number
  exactScoreHits: number
  correctOutcomeHits: number
  predictedMatchCount: number
  homeGoalPoints: number
  awayGoalPoints: number
  outcomePoints: number
  extraQuestionPoints: number
}

/**
 * A single match prediction entry for a player in a quiniela.
 * Used by the player predictions viewer.
 */
export type PlayerPredictionEntry = {
  matchId: string
  homeTeamName: string
  awayTeamName: string
  scheduledAt: string
  predictedHomeScore: number
  predictedAwayScore: number
  regulationHomeGoals: number
  regulationAwayGoals: number
  homeGoalPoint: 0 | 1
  awayGoalPoint: 0 | 1
  outcomePoint: 0 | 1
  totalPoints: 0 | 1 | 2 | 3
}

/**
 * A prediction joined with its quiniela context.
 * Used by ScoringService to compute and persist scores.
 */
export type PredictionWithQuiniela = {
  predictionId: string
  userId: string
  homeScore: number
  awayScore: number
  quinielaId: string
}

/** Percentages of crowd predictions broken down by outcome type. */
export type CrowdPercentages = {
  homeWinPct: number
  drawPct: number
  awayWinPct: number
}

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IPredictionScoreRepository {
  /**
   * Insert or update prediction_scores rows keyed on (prediction_id, quiniela_id).
   * Rows without an id/scoredAt are assigned by the DB.
   */
  upsertBatch(rows: Omit<PredictionScore, 'id' | 'scoredAt'>[]): Promise<void>

  /**
   * Return all predictions (with their quiniela context) for a given match.
   * Only includes predictions from approved memberships.
   */
  findPredictionsWithQuinielas(matchId: string): Promise<PredictionWithQuiniela[]>

  /**
   * Aggregate prediction_scores by user for a quiniela.
   * Returns one row per user with point totals, hit counts, and per-category breakdowns.
   */
  aggregateByQuiniela(quinielaId: string): Promise<
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
  >

  /**
   * Return all (homeScore, awayScore) crowd predictions for a match.
   * Used to compute homeWinPct / drawPct / awayWinPct.
   */
  findCrowdOutcomes(matchId: string): Promise<{ homeScore: number; awayScore: number }[]>

  /**
   * Return all (homeScore, awayScore) crowd predictions for a set of matches,
   * grouped by match id, in a single query. Matches with no predictions are
   * absent from the returned map.
   */
  findCrowdOutcomesByMatchIds(
    matchIds: string[],
  ): Promise<Map<string, { homeScore: number; awayScore: number }[]>>

  /**
   * Return all scored match predictions for a specific player in a quiniela.
   * Only returns entries for FINISHED matches with non-null regulation goals.
   *
   * Results are cached (process-scoped, TTL-based) keyed by
   * `${quinielaId}:${userId}`. Pass `options.isImpersonating: true` when the
   * caller's session is an admin "View as User" session — this routes the
   * read through a shorter-TTL cache so impersonated reads reflect recent
   * writes sooner (Decision B).
   */
  findPlayerPredictionsForViewer(
    quinielaId: string,
    userId: string,
    options?: { isImpersonating?: boolean },
  ): Promise<PlayerPredictionEntry[]>

  /**
   * Invalidate the cached findPlayerPredictionsForViewer entry (both the
   * normal and impersonated caches) for the given (quinielaId, userId) pair.
   * Called after prediction_scores are recalculated for a match so viewers
   * see fresh data.
   */
  invalidatePlayerPredictionsCache(quinielaId: string, userId: string): void
}

export interface IScoringService {
  recalculateMatchScores(matchId: string): Promise<void>
  getCrowdPercentages(matchId: string): Promise<CrowdPercentages>
  getCrowdPercentagesForMatches(matchIds: string[]): Promise<Map<string, CrowdPercentages>>
}

export interface ILeaderboardService {
  getLeaderboard(quinielaId: string): Promise<LeaderboardRow[]>
  getPlayerPredictions(
    quinielaId: string,
    userId: string,
    options?: { isImpersonating?: boolean },
  ): Promise<PlayerPredictionEntry[]>
}
