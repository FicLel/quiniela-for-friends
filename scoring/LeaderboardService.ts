/**
 * LeaderboardService — Application-layer service for the quiniela leaderboard.
 *
 * Aggregates prediction scores for a pool, enriches them with user emails,
 * applies the tie-breaking sort order, and assigns rank positions.
 *
 * Sort order:
 *   1. totalPoints       DESC
 *   2. exactScoreHits    DESC
 *   3. correctOutcomeHits DESC
 *   4. userId            ASC  (deterministic tiebreaker)
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js.
 * - All I/O goes through the injected repositories.
 */

import type { IPredictionScoreRepository, ILeaderboardService, LeaderboardRow } from '@/scoring/scoring.types'
import type { IUsersRepository } from '@/users/users.types'

export class LeaderboardService implements ILeaderboardService {
  constructor(
    private readonly repo: IPredictionScoreRepository,
    private readonly usersRepo: IUsersRepository,
  ) {}

  /**
   * Return the leaderboard for a quiniela, ranked by points then tiebreakers.
   *
   * Flow:
   * 1. Aggregate scores by user via repo.aggregateByQuiniela.
   * 2. Collect all unique user IDs.
   * 3. Fetch user emails via usersRepo.
   * 4. Sort and assign ranks.
   */
  async getLeaderboard(quinielaId: string): Promise<LeaderboardRow[]> {
    const aggregates = await this.repo.aggregateByQuiniela(quinielaId)

    if (aggregates.length === 0) return []

    // Resolve email for each userId
    const emailByUserId = new Map<string, string>()
    await Promise.all(
      aggregates.map(async (agg) => {
        const user = await this.usersRepo.findById(agg.userId)
        emailByUserId.set(agg.userId, user?.email ?? agg.userId)
      }),
    )

    // Sort: totalPoints desc → exactScoreHits desc → correctOutcomeHits desc → userId asc
    const sorted = [...aggregates].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.exactScoreHits !== a.exactScoreHits) return b.exactScoreHits - a.exactScoreHits
      if (b.correctOutcomeHits !== a.correctOutcomeHits) return b.correctOutcomeHits - a.correctOutcomeHits
      return a.userId.localeCompare(b.userId)
    })

    return sorted.map((agg, index) => ({
      rank: index + 1,
      userId: agg.userId,
      email: emailByUserId.get(agg.userId) ?? agg.userId,
      totalPoints: agg.totalPoints,
      exactScoreHits: agg.exactScoreHits,
      correctOutcomeHits: agg.correctOutcomeHits,
      predictedMatchCount: agg.predictedMatchCount,
    }))
  }
}
