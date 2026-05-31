/**
 * expectedResults.types.ts — Domain types, DTOs, and port interfaces for the
 * expectedResults module (user match score predictions).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Domain object returned by the repository — fully mapped from snake_case DB rows. */
export type ExpectedResult = {
  id: string
  userId: string
  matchId: string
  homeScore: number
  awayScore: number
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export type UpsertExpectedResultInput = {
  userId: string
  matchId: string
  homeScore: number
  awayScore: number
}

export type SaveExpectedResultResult =
  | { success: true }
  | { success: false; error: 'NOT_APPROVED' | 'INVALID_SCORE' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IExpectedResultsRepository {
  /** Insert or update a prediction row keyed on (user_id, match_id). */
  upsert(input: UpsertExpectedResultInput): Promise<void>
  /** Return all predictions for a given user. */
  findByUserId(userId: string): Promise<ExpectedResult[]>
  /** Delete all prediction rows for a given user. */
  deleteByUserId(userId: string): Promise<void>
}

export interface IExpectedResultsService {
  isUserApproved(userId: string): Promise<boolean>
  getExpectedResultsForUser(userId: string): Promise<ExpectedResult[]>
  upsertExpectedResult(
    userId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<SaveExpectedResultResult>
  /** Delete all prediction rows for a given user. No-op if none exist. */
  deleteExpectedResultsForUser(userId: string): Promise<void>
}
