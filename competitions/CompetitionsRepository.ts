/**
 * CompetitionsRepository — Infrastructure adapter for public.matches table.
 *
 * Implements ICompetitionsRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as UsersRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  ICompetitionsRepository,
  Match,
  MatchImportRecord,
} from '@/competitions/competitions.types'

export class CompetitionsRepository implements ICompetitionsRepository {
  private readonly supabase
  /** Resolves once on the first successful schema check; rejects if the table is absent. */
  private schemaCheck: Promise<void> | null = null

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    this.supabase = createClient(url, key)
  }

  /**
   * Lazily verifies that `public.matches` exists in the database.
   * The check is performed at most once per repository instance — subsequent
   * calls reuse the cached Promise so there is no repeated round-trip.
   *
   * Throws:
   *   Error: Supabase table "public.matches" does not exist — run pending migrations before starting the application.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('matches')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.matches" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  /**
   * Map a raw Supabase row (snake_case) to the Match domain type.
   */
  private toMatch(row: Record<string, unknown>): Match {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      stage: row.stage as string,
      group: row.group as string,
      matchday: row.matchday as number,
      status: row.status as string,
      scheduledAt: new Date(row.scheduled_at as string),
      homeTeamExternalId: row.home_team_external_id as number,
      homeTeamName: row.home_team_name as string,
      homeTeamShortName: row.home_team_short_name as string,
      homeTeamTla: row.home_team_tla as string,
      homeTeamCrest: (row.home_team_crest as string | null) ?? null,
      awayTeamExternalId: row.away_team_external_id as number,
      awayTeamName: row.away_team_name as string,
      awayTeamShortName: row.away_team_short_name as string,
      awayTeamTla: row.away_team_tla as string,
      awayTeamCrest: (row.away_team_crest as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Convert a MatchImportRecord (camelCase) to a DB row object (snake_case).
   */
  private toDbRow(record: MatchImportRecord): Record<string, unknown> {
    return {
      external_id: record.externalId,
      stage: record.stage,
      group: record.group,
      matchday: record.matchday,
      status: record.status,
      scheduled_at: record.scheduledAt,
      home_team_external_id: record.homeTeamExternalId,
      home_team_name: record.homeTeamName,
      home_team_short_name: record.homeTeamShortName,
      home_team_tla: record.homeTeamTla,
      home_team_crest: record.homeTeamCrest,
      away_team_external_id: record.awayTeamExternalId,
      away_team_name: record.awayTeamName,
      away_team_short_name: record.awayTeamShortName,
      away_team_tla: record.awayTeamTla,
      away_team_crest: record.awayTeamCrest,
    }
  }

  /**
   * Upsert match records, keyed on external_id.
   * Returns the number of records submitted for upsert.
   * Throws on Supabase error.
   */
  async upsertMatches(records: MatchImportRecord[]): Promise<number> {
    await this.verifySchema()

    const rows = records.map((r) => this.toDbRow(r))

    const { error } = await this.supabase
      .from('matches')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false })

    if (error) {
      throw new Error(`upsertMatches failed: ${error.message}`)
    }

    return rows.length
  }

  /**
   * Return all matches ordered by group → matchday → scheduled_at.
   * Returns [] if the table is empty.
   * Throws on Supabase error.
   */
  async findAllGroupStageMatches(): Promise<Match[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .order('group')
      .order('matchday')
      .order('scheduled_at')

    if (error) {
      throw new Error(`findAllGroupStageMatches failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return data.map((row) => this.toMatch(row as Record<string, unknown>))
  }
}
