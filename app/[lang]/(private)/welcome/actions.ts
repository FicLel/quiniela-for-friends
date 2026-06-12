'use server'

import { CompetitionsClient } from '@/competitions/CompetitionsClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { CompetitionsService } from '@/competitions/CompetitionsService'
import type {
  ImportMatchesResult,
  SeedPlaceholdersResult,
  SyncRegulationResultsResult,
} from '@/competitions/competitions.types'
import { AuthClient } from '@/auth/AuthClient'
import { ExpectedResultsRepository } from '@/expectedResults/ExpectedResultsRepository'
import { ExpectedResultsService } from '@/expectedResults/ExpectedResultsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import type { SaveExpectedResultResult } from '@/expectedResults/expectedResults.types'
import { ScoringService } from '@/scoring/ScoringService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

async function getSession() {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  return token ? await authClient.verifyToken(token) : null
}

export async function importWorldCupMatches(): Promise<ImportMatchesResult> {
  const session = await getSession()
  if (session?.role !== 'admin') return { success: false, error: 'FETCH_FAILED' }
  const service = new CompetitionsService(new CompetitionsClient(), new CompetitionsRepository())
  return service.importGroupStageMatches()
}

/**
 * Save or update a user's expected score for a match.
 *
 * Requires an active session. If no session is found, returns NOT_APPROVED
 * (the user cannot interact with predictions without being authenticated).
 *
 * @param quinielaId - When provided, scopes the prediction to a specific quiniela
 *   (per_quiniela mode). When absent, the prediction is shared across all quinielas.
 */
export async function saveExpectedResult(
  quinielaId: string | undefined,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<SaveExpectedResultResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'NOT_APPROVED' }
  }

  const service = new ExpectedResultsService(
    new ExpectedResultsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
  )

  return service.upsertExpectedResult(session.sub, matchId, homeScore, awayScore, quinielaId ?? null)
}

/**
 * Seed knockout bracket placeholder matches into the database (admin-only).
 */
export async function seedKnockoutPlaceholders(): Promise<SeedPlaceholdersResult> {
  const session = await getSession()
  if (session?.role !== 'admin') return { success: false, error: 'UNKNOWN_ERROR' }
  const service = new CompetitionsService(new CompetitionsClient(), new CompetitionsRepository())
  return service.seedKnockoutPlaceholders()
}

/**
 * Sync knockout match team details from the external API into the DB (admin-only).
 */
export async function syncKnockoutMatches(): Promise<ImportMatchesResult> {
  const session = await getSession()
  if (session?.role !== 'admin') return { success: false, error: 'FETCH_FAILED' }
  const service = new CompetitionsService(new CompetitionsClient(), new CompetitionsRepository())
  return service.syncKnockoutMatches()
}

/**
 * Update the official regulation-time result for a single match and recalculate
 * prediction scores for everyone who picked it (admin-only).
 */
export async function syncMatchResult(
  matchId: string,
  regulationHomeGoals: number,
  regulationAwayGoals: number,
): Promise<SyncRegulationResultsResult> {
  const session = await getSession()
  if (session?.role !== 'admin') return { success: false, error: 'UNAUTHORIZED' }

  if (!isNonNegativeInteger(regulationHomeGoals) || !isNonNegativeInteger(regulationAwayGoals)) {
    return { success: false, error: 'INVALID_PAYLOAD' }
  }

  const competitionsRepo = new CompetitionsRepository()
  const scoringService = new ScoringService(new PredictionScoreRepository(), competitionsRepo)
  const service = new CompetitionsService(new CompetitionsClient(), competitionsRepo, scoringService)

  return service.syncRegulationResults([{ matchId, regulationHomeGoals, regulationAwayGoals }])
}
