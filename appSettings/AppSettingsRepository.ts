/**
 * AppSettingsRepository — Infrastructure adapter for public.app_settings table.
 *
 * Implements IAppSettingsRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as other repositories:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { getSupabaseServerClient } from '@/lib/supabaseServerClient'
import { verifyTableOnce } from '@/lib/schemaCheckCache'
import { TtlCache } from '@/lib/ttlCache'
import type {
  IAppSettingsRepository,
  AppSettings,
  PredictionMode,
} from '@/appSettings/appSettings.types'

/**
 * Process-scoped cache for the single settings row. Settings change rarely
 * (admin action) but are read on every page view; writes invalidate the key
 * so changes are visible immediately on this instance.
 */
const settingsCache = new TtlCache<AppSettings | null>(60_000, 1)
const SETTINGS_CACHE_KEY = 'app_settings'

/** Clear the settings cache — intended for tests only. */
export function resetAppSettingsCache(): void {
  settingsCache.clear()
}

export class AppSettingsRepository implements IAppSettingsRepository {
  private readonly supabase

  constructor() {
    this.supabase = getSupabaseServerClient()
  }

  /**
   * Lazily verifies that `public.app_settings` exists in the database.
   * The check is performed at most once per server process.
   */
  private verifySchema(): Promise<void> {
    return verifyTableOnce('app_settings', async () => {
      const { error } = await this.supabase
        .from('app_settings')
        .select('id')
        .limit(0)

      if (error) {
        throw new Error(
          'Supabase table "public.app_settings" does not exist — run pending migrations before starting the application.',
        )
      }
    })
  }

  private toAppSettings(row: Record<string, unknown>): AppSettings {
    return {
      id: row.id as string,
      predictionMode: row.prediction_mode as PredictionMode,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Return the single settings row, or null if the table is empty.
   * Served from the process-scoped cache for up to 60s; writes invalidate it.
   * Throws on Supabase error.
   */
  async find(): Promise<AppSettings | null> {
    const cached = settingsCache.get(SETTINGS_CACHE_KEY)
    if (cached !== undefined) return cached

    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`find app_settings failed: ${error.message}`)
    }

    const settings = data ? this.toAppSettings(data as Record<string, unknown>) : null
    settingsCache.set(SETTINGS_CACHE_KEY, settings)
    return settings
  }

  /**
   * Upsert the single settings row with the given prediction_mode.
   *
   * Since the table has a unique index on (true), INSERT ... ON CONFLICT DO NOTHING
   * will silently ignore a duplicate. We use:
   *   1. UPDATE all rows (expected path — seed row always exists).
   *   2. SELECT to check whether a row exists after the update.
   *   3. INSERT only if the row was missing (seed was never run).
   *
   * Throws on Supabase error.
   */
  async setPredictionMode(mode: PredictionMode): Promise<void> {
    await this.verifySchema()

    // Try update first (expected path — seed row always exists)
    const { error: updateError } = await this.supabase
      .from('app_settings')
      .update({ prediction_mode: mode })
      .gt('id', '00000000-0000-0000-0000-000000000000') // matches all rows

    if (updateError) {
      throw new Error(`setPredictionMode update failed: ${updateError.message}`)
    }

    // Verify at least one row exists; insert seed row if not
    const { data: existing, error: checkError } = await this.supabase
      .from('app_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`setPredictionMode check failed: ${checkError.message}`)
    }

    if (!existing) {
      const { error: insertError } = await this.supabase
        .from('app_settings')
        .insert({ prediction_mode: mode })

      if (insertError) {
        throw new Error(`setPredictionMode insert failed: ${insertError.message}`)
      }
    }

    // Drop the cached row only after the write lands so a concurrent find()
    // cannot repopulate the cache with the value we are replacing.
    settingsCache.invalidate(SETTINGS_CACHE_KEY)
  }

  /**
   * Return the ID of the oldest quiniela (min created_at) that has at least one
   * approved member. Returns null if no such quiniela exists.
   * Throws on Supabase error.
   */
  async findOldestQuinielaId(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('quiniela_memberships')
      .select('quiniela_id, quinielas!inner(created_at, id)')
      .not('approved_at', 'is', null)
      .order('quinielas(created_at)', { ascending: true })
      .order('quinielas(id)', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`findOldestQuinielaId failed: ${error.message}`)
    }

    if (!data) return null

    return (data as Record<string, unknown>).quiniela_id as string
  }

  /**
   * Migrate all shared predictions (quiniela_id IS NULL) to the given quiniela.
   * UPDATE user_expected_results SET quiniela_id = <quinielaId> WHERE quiniela_id IS NULL
   * Idempotent — rows already with a quiniela_id are untouched.
   * Throws on Supabase error.
   */
  async migrateSharedPredictions(quinielaId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_expected_results')
      .update({ quiniela_id: quinielaId })
      .is('quiniela_id', null)

    if (error) {
      throw new Error(`migrateSharedPredictions failed: ${error.message}`)
    }
  }
}
