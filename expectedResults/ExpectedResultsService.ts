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
  IMatchKickoffReader,
  ExpectedResult,
  SaveExpectedResultResult,
} from '@/expectedResults/expectedResults.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'

export class ExpectedResultsService implements IExpectedResultsService {
  constructor(
    private readonly repository: IExpectedResultsRepository,
    private readonly membershipsRepository: IMembershipsRepository,
    private readonly kickoffReader?: IMatchKickoffReader,
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
   * Return all predictions for a given user scoped to a quiniela.
   * Pass null as quinielaId to retrieve shared (NULL quiniela_id) predictions.
   * Delegates directly to the repository — no additional business rules apply.
   */
  async findByUserIdAndQuiniela(
    userId: string,
    quinielaId: string | null,
  ): Promise<ExpectedResult[]> {
    return this.repository.findByUserIdAndQuiniela(userId, quinielaId)
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
   * 3. If kickoffReader is provided, check that the match has not yet kicked off
   *    (kickoffAt > now). If kickoffAt <= now → LOCKED.
   * 4. Call repository.upsert (with optional quinielaId); if it throws → UNKNOWN_ERROR.
   * 5. Return { success: true } on success.
   *
   * @param quinielaId - When provided, scopes the prediction to a specific quiniela
   *   (per_quiniela mode). When null/undefined, the prediction is shared across all quinielas.
   */
  async upsertExpectedResult(
    userId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    quinielaId?: string | null,
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

      // 3. Check kickoff lock
      if (this.kickoffReader) {
        const kickoffAt = await this.kickoffReader.findKickoffAt(matchId)
        if (kickoffAt !== null && kickoffAt <= new Date()) {
          return { success: false, error: 'LOCKED' }
        }
      }

      // 4. Persist (pass quinielaId through — null means shared prediction)
      await this.repository.upsert({ userId, matchId, homeScore, awayScore, quinielaId })

      // 5. Success
      return { success: true }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
