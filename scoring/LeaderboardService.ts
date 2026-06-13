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

import type { IPredictionScoreRepository, ILeaderboardService, LeaderboardRow, PlayerPredictionEntry } from '@/scoring/scoring.types'
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
   * 2. Merge in approved members who have no scored predictions yet (zero rows),
   *    so newcomers always appear on the leaderboard.
   * 3. Resolve user emails via membership records, falling back to usersRepo.
   * 4. Sort and assign ranks.
   */
  async getLeaderboard(quinielaId: string): Promise<LeaderboardRow[]> {
    const [aggregates, members] = await Promise.all([
      this.repo.aggregateByQuiniela(quinielaId),
      this.membershipsRepo.findAllByQuiniela(quinielaId),
    ])

    const approvedMembers = members.filter((m) => m.approvedAt !== null)
    const aggregateUserIds = new Set(aggregates.map((agg) => agg.userId))

    // Approved members without any scored predictions yet appear as zero rows
    const zeroRows = approvedMembers
      .filter((m) => !aggregateUserIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        totalPoints: 0,
        exactScoreHits: 0,
        correctOutcomeHits: 0,
        predictedMatchCount: 0,
        homeGoalPoints: 0,
        awayGoalPoints: 0,
        outcomePoints: 0,
        extraQuestionPoints: 0,
      }))

    const allAggregates = [...aggregates, ...zeroRows]

    if (allAggregates.length === 0) {
      return []
    }

    // Prefer emails already joined with membership records; only query
    // usersRepo for any remaining userIds (single batched query).
    const memberEmailByUserId = new Map(approvedMembers.map((m) => [m.userId, m.email]))
    const idsNeedingLookup = allAggregates
      .map((agg) => agg.userId)
      .filter((userId) => !memberEmailByUserId.has(userId))

    const emailByUserId = new Map<string, string>(memberEmailByUserId)
    if (idsNeedingLookup.length > 0) {
      const users = await this.usersRepo.findByIds(idsNeedingLookup)
      for (const u of users) {
        emailByUserId.set(u.id, u.email)
      }
    }

    // Sort: totalPoints desc → exactScoreHits desc → correctOutcomeHits desc → email asc
    const sorted = [...allAggregates].sort((a, b) => {
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
      homeGoalPoints: agg.homeGoalPoints,
      awayGoalPoints: agg.awayGoalPoints,
      outcomePoints: agg.outcomePoints,
      extraQuestionPoints: agg.extraQuestionPoints,
    }))
  }

  /**
   * Return all scored match predictions for a specific player in a quiniela.
   * Delegates directly to the repository.
   *
   * Pass `options.isImpersonating: true` when the caller's session is an
   * admin "View as User" session, so the repository routes the read through
   * its shorter-TTL cache (Decision B).
   */
  async getPlayerPredictions(
    quinielaId: string,
    userId: string,
    options?: { isImpersonating?: boolean },
  ): Promise<PlayerPredictionEntry[]> {
    return this.repo.findPlayerPredictionsForViewer(quinielaId, userId, options)
  }
}
