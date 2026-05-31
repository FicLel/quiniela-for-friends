/**
 * ExpectedResultsService — Application-layer service for user match score predictions.
 *
 * Contains all business rules for saving and retrieving expected results.
 * Depends on IExpectedResultsRepository and IMembershipsRepository through its
 * constructor so both can be swapped with test doubles.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repositories.
 */

import type {
  IExpectedResultsRepository,
  IExpectedResultsService,
  ExpectedResult,
  SaveExpectedResultResult,
} from '@/expectedResults/expectedResults.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'

export class ExpectedResultsService implements IExpectedResultsService {
  constructor(
    private readonly repository: IExpectedResultsRepository,
    private readonly membershipsRepository: IMembershipsRepository,
  ) {}

  /**
   * Returns true if the user has at least one approved membership
   * (a row in quiniela_memberships where approved_at IS NOT NULL).
   */
  async isUserApproved(userId: string): Promise<boolean> {
    const count = await this.membershipsRepository.countByUser(userId)
    return count > 0
  }

  /**
   * Return all saved predictions for the given user.
   */
  async getExpectedResultsForUser(userId: string): Promise<ExpectedResult[]> {
    return this.repository.findByUserId(userId)
  }

  /**
   * Delete all prediction rows for the given user.
   * No-op when the user has no predictions.
   * Delegates directly to the repository — no additional business rules apply.
   */
  async deleteExpectedResultsForUser(userId: string): Promise<void> {
    await this.repository.deleteByUserId(userId)
  }

  /**
   * Save or update a score prediction for a match.
   *
   * Business rules:
   * 1. User must have at least one approved membership → NOT_APPROVED.
   * 2. homeScore and awayScore must be non-negative integers → INVALID_SCORE.
   * 3. Call repository.upsert; if it throws → UNKNOWN_ERROR.
   * 4. Return { success: true } on success.
   */
  async upsertExpectedResult(
    userId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<SaveExpectedResultResult> {
    try {
      // 1. Check approval
      const approved = await this.isUserApproved(userId)
      if (!approved) {
        return { success: false, error: 'NOT_APPROVED' }
      }

      // 2. Validate scores
      if (!Number.isInteger(homeScore) || homeScore < 0) {
        return { success: false, error: 'INVALID_SCORE' }
      }
      if (!Number.isInteger(awayScore) || awayScore < 0) {
        return { success: false, error: 'INVALID_SCORE' }
      }

      // 3. Persist
      await this.repository.upsert({ userId, matchId, homeScore, awayScore })

      // 4. Success
      return { success: true }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
