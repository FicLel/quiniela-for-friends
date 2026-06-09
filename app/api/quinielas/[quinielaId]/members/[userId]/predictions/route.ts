/**
 * GET /api/quinielas/[quinielaId]/members/[userId]/predictions
 *
 * Returns all scored match predictions for a specific player in a quiniela.
 * Any approved member of the quiniela may view any other member's predictions.
 *
 * Auth    : valid session required
 * Params  : quinielaId (UUID) — the quiniela ID
 *           userId     (UUID) — the target player whose predictions to fetch
 *
 * Returns :
 *   200: { success: true; predictions: PlayerPredictionEntry[] }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'UNKNOWN_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { LeaderboardService } from '@/scoring/LeaderboardService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'
import type { PlayerPredictionEntry } from '@/scoring/scoring.types'

type PredictionsResponse =
  | { success: true; predictions: PlayerPredictionEntry[] }
  | { success: false; error: 'UNAUTHORIZED' | 'UNKNOWN_ERROR' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quinielaId: string; userId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: PredictionsResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Resolve route params
  const { quinielaId, userId } = await params

  try {
    // 3. isApprovedMember check — caller (session.sub) must be an approved member
    const membershipsRepo = new MembershipsRepository()
    const isApproved = await membershipsRepo.isApprovedMember(quinielaId, session.sub)
    if (!isApproved) {
      const result: PredictionsResponse = { success: false, error: 'UNAUTHORIZED' }
      return Response.json(result, { status: 403 })
    }

    // 4. Fetch the target player's predictions
    const leaderboardService = new LeaderboardService(
      new PredictionScoreRepository(),
      new UsersRepository(),
      membershipsRepo,
    )
    const predictions = await leaderboardService.getPlayerPredictions(quinielaId, userId)

    const result: PredictionsResponse = { success: true, predictions }
    return Response.json(result, { status: 200 })
  } catch {
    const result: PredictionsResponse = { success: false, error: 'UNKNOWN_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
