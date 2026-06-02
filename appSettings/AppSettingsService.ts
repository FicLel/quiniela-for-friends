/**
 * AppSettingsService — Application-layer service for application-wide settings.
 *
 * Contains all business rules for reading and changing the global prediction mode.
 * Depends on IAppSettingsRepository through its constructor so it can be swapped
 * with a test double.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repository.
 *
 * Business rules:
 *   setPredictionMode('per_quiniela'):
 *     1. Find the oldest quiniela with at least one approved member.
 *     2. If found, migrate all NULL quiniela_id rows to that quiniela.
 *     3. Save prediction_mode = 'per_quiniela'.
 *
 *   setPredictionMode('shared'):
 *     Just save the mode — prediction rows are NOT touched.
 */

import type {
  IAppSettingsRepository,
  IAppSettingsService,
  AppSettings,
  PredictionMode,
  GetSettingsResult,
  SetPredictionModeResult,
} from '@/appSettings/appSettings.types'

export class AppSettingsService implements IAppSettingsService {
  constructor(private readonly repository: IAppSettingsRepository) {}

  /**
   * Return the current application settings.
   * Returns a NOT_FOUND error if the settings row has not been seeded.
   */
  async getSettings(): Promise<GetSettingsResult> {
    try {
      const settings = await this.repository.find()
      if (!settings) {
        return { success: false, error: 'NOT_FOUND' }
      }
      return { success: true, settings }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Set the global prediction mode.
   *
   * When switching to 'per_quiniela':
   *   1. Find the oldest quiniela with at least one approved member.
   *   2. If found, run migrateSharedPredictions to assign quiniela_id to
   *      all rows where quiniela_id IS NULL.
   *   3. Save the new mode.
   *
   * When switching to 'shared':
   *   Just save the mode — prediction rows are not touched.
   *
   * Returns INVALID_MODE if the value is not a valid PredictionMode.
   */
  async setPredictionMode(mode: PredictionMode): Promise<SetPredictionModeResult> {
    if (mode !== 'shared' && mode !== 'per_quiniela') {
      return { success: false, error: 'INVALID_MODE' }
    }

    try {
      if (mode === 'per_quiniela') {
        // 1. Find the oldest quiniela with an approved member
        const quinielaId = await this.repository.findOldestQuinielaId()

        // 2. Migrate NULL rows if a quiniela is found
        if (quinielaId !== null) {
          await this.repository.migrateSharedPredictions(quinielaId)
        }
      }

      // 3. Persist the new mode
      await this.repository.setPredictionMode(mode)

      return { success: true }
    } catch {
      return { success: false, error: 'DB_ERROR' }
    }
  }
}
