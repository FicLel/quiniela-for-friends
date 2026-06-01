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
 *   4. email             ASC  (alphabetical tiebreaker)
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js.
 * - All I/O goes through the injected repositories.
 */

import type { IPredictionScoreRepository, ILeaderboardService, LeaderboardRow } from '@/scoring/scoring.types'
import type { IUsersRepository } from '@/users/users.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'

export class LeaderboardService implements ILeaderboardService {
  constructor(
    private readonly repo: IPredictionScoreRepository,
    private readonly usersRepo: IUsersRepository,
    private readonly membershipsRepo: IMembershipsRepository,
  ) {}

  /**
   * Return the leaderboard for a quiniela, ranked by points then tiebreakers.
   *
   * Flow:
   * 1. Aggregate scores by user via repo.aggregateByQuiniela.
   * 2. If no scores exist yet, fall back to all approved members sorted alphabetically by email.
   * 3. Resolve user emails via usersRepo.
   * 4. Sort and assign ranks.
   */
  async getLeaderboard(quinielaId: string): Promise<LeaderboardRow[]> {
    const aggregates = await this.repo.aggregateByQuiniela(quinielaId)

    if (aggregates.length === 0) {
      const members = await this.membershipsRepo.findAllByQuiniela(quinielaId)
      return members
        .filter((m) => m.approvedAt !== null)
        .sort((a, b) => a.email.localeCompare(b.email))
        .map((m, index) => ({
          rank: index + 1,
          userId: m.userId,
          email: m.email,
          totalPoints: 0,
          exactScoreHits: 0,
          correctOutcomeHits: 0,
          predictedMatchCount: 0,
        }))
    }

    // Resolve email for each userId
    const emailByUserId = new Map<string, string>()
    await Promise.all(
      aggregates.map(async (agg) => {
        const user = await this.usersRepo.findById(agg.userId)
        emailByUserId.set(agg.userId, user?.email ?? agg.userId)
      }),
    )

    // Sort: totalPoints desc → exactScoreHits desc → correctOutcomeHits desc → email asc
    const sorted = [...aggregates].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.exactScoreHits !== a.exactScoreHits) return b.exactScoreHits - a.exactScoreHits
      if (b.correctOutcomeHits !== a.correctOutcomeHits) return b.correctOutcomeHits - a.correctOutcomeHits
      return (emailByUserId.get(a.userId) ?? a.userId).localeCompare(
        emailByUserId.get(b.userId) ?? b.userId,
      )
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
