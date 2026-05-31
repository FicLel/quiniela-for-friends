'use server'

import { CompetitionsClient } from '@/competitions/CompetitionsClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { CompetitionsService } from '@/competitions/CompetitionsService'
import type { ImportMatchesResult } from '@/competitions/competitions.types'
import { AuthClient } from '@/auth/AuthClient'
import { ExpectedResultsRepository } from '@/expectedResults/ExpectedResultsRepository'
import { ExpectedResultsService } from '@/expectedResults/ExpectedResultsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import type { SaveExpectedResultResult } from '@/expectedResults/expectedResults.types'

export async function importWorldCupMatches(): Promise<ImportMatchesResult> {
  const client = new CompetitionsClient()
  const repository = new CompetitionsRepository()
  const service = new CompetitionsService(client, repository)
  return service.importGroupStageMatches()
}

/**
 * Save or update a user's expected score for a match.
 *
 * Requires an active session. If no session is found, returns NOT_APPROVED
 * (the user cannot interact with predictions without being authenticated).
 */
export async function saveExpectedResult(
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
  )

  return service.upsertExpectedResult(session.sub, matchId, homeScore, awayScore)
}
