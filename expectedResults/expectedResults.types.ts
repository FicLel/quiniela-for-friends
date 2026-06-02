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
  /** Present when prediction_mode is 'per_quiniela'; null for shared predictions. */
  quinielaId: string | null
  homeScore: number
  awayScore: number
  lockedAt: Date | null
  submittedAt: Date | null
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
  /** When set, the prediction is scoped to a specific quiniela (per_quiniela mode). */
  quinielaId?: string | null
}

export type SaveExpectedResultResult =
  | { success: true }
  | { success: false; error: 'NOT_APPROVED' | 'INVALID_SCORE' | 'LOCKED' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IExpectedResultsRepository {
  /** Insert or update a prediction row keyed on (user_id, match_id) or (user_id, match_id, quiniela_id). */
  upsert(input: UpsertExpectedResultInput): Promise<void>
  /** Return all predictions for a given user. */
  findByUserId(userId: string): Promise<ExpectedResult[]>
  /** Delete all prediction rows for a given user. */
  deleteByUserId(userId: string): Promise<void>
  /** Return all predictions for a given match. */
  findByMatchId(matchId: string): Promise<ExpectedResult[]>
  /**
   * Return all predictions for a given user scoped to a quiniela.
   * Pass null as quinielaId to retrieve shared (NULL quiniela_id) predictions.
   */
  findByUserIdAndQuiniela(userId: string, quinielaId: string | null): Promise<ExpectedResult[]>
}

/**
 * Port for reading a match kickoff timestamp.
 * Implemented by CompetitionsRepository; injected into ExpectedResultsService
 * so the service never imports infrastructure directly.
 */
export interface IMatchKickoffReader {
  /** Return the scheduled_at timestamp for the given match, or null if not found. */
  findKickoffAt(matchId: string): Promise<Date | null>
}

export interface IExpectedResultsService {
  isUserApproved(userId: string): Promise<boolean>
  getExpectedResultsForUser(userId: string): Promise<ExpectedResult[]>
  upsertExpectedResult(
    userId: string,
    matchId: string,
    homeScore: number,
    awayScore: number,
    quinielaId?: string | null,
  ): Promise<SaveExpectedResultResult>
  /** Delete all prediction rows for a given user. No-op if none exist. */
  deleteExpectedResultsForUser(userId: string): Promise<void>
}
