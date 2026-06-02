/**
 * appSettings.types.ts — Domain types, DTOs, and port interfaces for the
 * appSettings module (application-wide configuration, single-row settings table).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type PredictionMode = 'shared' | 'per_quiniela'

export type AppSettings = {
  id: string
  predictionMode: PredictionMode
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export type SetPredictionModeResult =
  | { success: true }
  | { success: false; error: 'INVALID_MODE' | 'DB_ERROR' | 'UNKNOWN_ERROR' }

export type GetSettingsResult =
  | { success: true; settings: AppSettings }
  | { success: false; error: 'NOT_FOUND' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IAppSettingsRepository {
  /** Return the single settings row, or null if not yet seeded. */
  find(): Promise<AppSettings | null>
  /** Upsert the single settings row with the given prediction_mode. */
  setPredictionMode(mode: PredictionMode): Promise<void>
  /**
   * Return the ID of the oldest quiniela (by created_at) that has at least
   * one approved member (approved_at IS NOT NULL). Returns null if none found.
   * Used during migration to per_quiniela mode to determine the target quiniela.
   */
  findOldestQuinielaId(): Promise<string | null>
  /**
   * Migrate all shared predictions (quiniela_id IS NULL) to the given quiniela.
   * UPDATE user_expected_results SET quiniela_id = <id> WHERE quiniela_id IS NULL
   * Idempotent: rows already with a quiniela_id are not re-assigned.
   */
  migrateSharedPredictions(quinielaId: string): Promise<void>
}

export interface IAppSettingsService {
  getSettings(): Promise<GetSettingsResult>
  /**
   * Set the global prediction mode.
   *
   * When switching to 'per_quiniela':
   *   1. Find the oldest quiniela with at least one approved member.
   *   2. If found, migrate all NULL quiniela_id rows to that quiniela.
   *   3. Save the new mode.
   *
   * When switching to 'shared':
   *   Just save the mode — prediction rows are not touched.
   */
  setPredictionMode(mode: PredictionMode): Promise<SetPredictionModeResult>
}
