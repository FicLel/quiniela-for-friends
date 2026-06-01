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
   * Returns one row per user with point totals and hit counts.
   */
  aggregateByQuiniela(quinielaId: string): Promise<
    {
      userId: string
      totalPoints: number
      exactScoreHits: number
      correctOutcomeHits: number
      predictedMatchCount: number
    }[]
  >

  /**
   * Return all (homeScore, awayScore) crowd predictions for a match.
   * Used to compute homeWinPct / drawPct / awayWinPct.
   */
  findCrowdOutcomes(matchId: string): Promise<{ homeScore: number; awayScore: number }[]>
}

export interface IScoringService {
  recalculateMatchScores(matchId: string): Promise<void>
  getCrowdPercentages(matchId: string): Promise<CrowdPercentages>
}

export interface ILeaderboardService {
  getLeaderboard(quinielaId: string): Promise<LeaderboardRow[]>
}
