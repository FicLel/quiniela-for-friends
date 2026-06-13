/**
 * GET /api/pools/[poolId]/leaderboard
 *
 * Returns the leaderboard for a quiniela pool. Requires the caller to be
 * authenticated and to be an approved member of the pool.
 *
 * Auth   : valid session required
 * Params : poolId (UUID) — the quiniela / pool ID
 * Returns: { success: true; leaderboard: LeaderboardRow[] }
 *          | { success: false; error: 'UNAUTHORIZED' | 'NOT_A_MEMBER' | 'UNKNOWN_ERROR' }
 *
 * HTTP status codes:
 *   200 — success
 *   403 — not authenticated or not a member
 *   500 — unexpected error
 */

import { AuthClient } from '@/auth/AuthClient'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { LeaderboardService } from '@/scoring/LeaderboardService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'
import type { LeaderboardRow } from '@/scoring/scoring.types'

type LeaderboardResponse =
  | { success: true; leaderboard: LeaderboardRow[] }
  | { success: false; error: 'UNAUTHORIZED' | 'NOT_A_MEMBER' | 'UNKNOWN_ERROR' }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: LeaderboardResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Resolve poolId from dynamic route
  const { poolId } = await params

  // 3. Verify membership — the effective viewer (impersonated user, if any,
  // otherwise the real session user) must be an approved member of the pool
  try {
    const membershipsRepo = new MembershipsRepository()
    const isMember = await membershipsRepo.isApprovedMember(poolId, authClient.getEffectiveUserId(session))
    if (!isMember) {
      const result: LeaderboardResponse = { success: false, error: 'NOT_A_MEMBER' }
      return Response.json(result, { status: 403 })
    }

    // 4. Fetch leaderboard
    const leaderboardService = new LeaderboardService(
      new PredictionScoreRepository(),
      new UsersRepository(),
      membershipsRepo,
    )
    const leaderboard = await leaderboardService.getLeaderboard(poolId)

    const result: LeaderboardResponse = { success: true, leaderboard }
    return Response.json(result, { status: 200 })
  } catch {
    const result: LeaderboardResponse = { success: false, error: 'UNKNOWN_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
