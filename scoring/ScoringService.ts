/**
 * ScoringService — Application-layer service for three-point match scoring.
 *
 * Contains all business logic for recalculating prediction scores after a
 * match result is posted, and for computing crowd prediction percentages.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js.
 * - All I/O goes through the injected repositories.
 */

import type { IPredictionScoreRepository, IScoringService, ScoreBreakdown, CrowdPercentages } from '@/scoring/scoring.types'
import type { ICompetitionsRepository } from '@/competitions/competitions.types'

// ---------------------------------------------------------------------------
// Pure scoring function (no I/O, fully testable in isolation)
// ---------------------------------------------------------------------------

type Outcome = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'

function deriveOutcome(homeGoals: number, awayGoals: number): Outcome {
  if (homeGoals > awayGoals) return 'HOME_WIN'
  if (homeGoals < awayGoals) return 'AWAY_WIN'
  return 'DRAW'
}

/**
 * Calculate the three-point breakdown for a single prediction against a
 * known match result.
 *
 * Points awarded:
 *  - 1 pt for correctly predicting the home team's goals.
 *  - 1 pt for correctly predicting the away team's goals.
 *  - 1 pt for correctly predicting the match outcome (WIN / DRAW / WIN).
 */
export function calculateScore(
  prediction: { homeScore: number; awayScore: number },
  match: { regulationHomeGoals: number; regulationAwayGoals: number },
): ScoreBreakdown {
  const homeGoalPoint = prediction.homeScore === match.regulationHomeGoals ? 1 : 0
  const awayGoalPoint = prediction.awayScore === match.regulationAwayGoals ? 1 : 0
  const predictedOutcome = deriveOutcome(prediction.homeScore, prediction.awayScore)
  const actualOutcome = deriveOutcome(match.regulationHomeGoals, match.regulationAwayGoals)
  const outcomePoint = predictedOutcome === actualOutcome ? 1 : 0
  const totalPoints = (homeGoalPoint + awayGoalPoint + outcomePoint) as 0 | 1 | 2 | 3
  return { homeGoalPoint, awayGoalPoint, outcomePoint, totalPoints }
}

// ---------------------------------------------------------------------------
// ScoringService class
// ---------------------------------------------------------------------------

export class ScoringService implements IScoringService {
  constructor(
    private readonly repo: IPredictionScoreRepository,
    private readonly competitionsRepo: ICompetitionsRepository,
  ) {}

  /**
   * Recalculate and persist prediction scores for all predictions on a match.
   *
   * Flow:
   * 1. Fetch the match via competitionsRepo.findById.
   *    - If not found, or regulation goals are null, or status is CANCELLED → skip (return early).
   * 2. Fetch all predictions for the match (approved memberships only).
   * 3. For each prediction, calculate the score breakdown.
   * 4. Upsert the batch.
   */
  async recalculateMatchScores(matchId: string): Promise<void> {
    const match = await this.competitionsRepo.findById(matchId)

    if (!match) return
    if (match.status === 'CANCELLED') return
    if (match.regulationHomeGoals === null || match.regulationAwayGoals === null) return

    const regulationResult = {
      regulationHomeGoals: match.regulationHomeGoals,
      regulationAwayGoals: match.regulationAwayGoals,
    }

    const predictions = await this.repo.findPredictionsWithQuinielas(matchId)

    const rows = predictions.map((p) => {
      const breakdown = calculateScore(
        { homeScore: p.homeScore, awayScore: p.awayScore },
        regulationResult,
      )
      return {
        predictionId: p.predictionId,
        quinielaId: p.quinielaId,
        homeGoalPoint: breakdown.homeGoalPoint,
        awayGoalPoint: breakdown.awayGoalPoint,
        outcomePoint: breakdown.outcomePoint,
        totalPoints: breakdown.totalPoints,
      }
    })

    await this.repo.upsertBatch(rows)
  }

  /**
   * Compute the percentage of crowd predictions that fall into each outcome
   * category (home win / draw / away win) for a match.
   *
   * Returns zeroes when no predictions have been submitted.
   */
  async getCrowdPercentages(matchId: string): Promise<CrowdPercentages> {
    const outcomes = await this.repo.findCrowdOutcomes(matchId)

    if (outcomes.length === 0) {
      return { homeWinPct: 0, drawPct: 0, awayWinPct: 0 }
    }

    let homeWins = 0
    let draws = 0
    let awayWins = 0

    for (const o of outcomes) {
      const outcome = deriveOutcome(o.homeScore, o.awayScore)
      if (outcome === 'HOME_WIN') homeWins++
      else if (outcome === 'DRAW') draws++
      else awayWins++
    }

    const total = outcomes.length
    return {
      homeWinPct: Math.floor((homeWins / total) * 100),
      drawPct: Math.floor((draws / total) * 100),
      awayWinPct: Math.floor((awayWins / total) * 100),
    }
  }
}
