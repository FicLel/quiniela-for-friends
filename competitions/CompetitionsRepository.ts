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
  KnockoutPlaceholderRecord,
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
      externalId: row.external_id as number | null,
      stage: row.stage as string,
      group: row.group as string,
      matchday: row.matchday as number,
      status: row.status as string,
      scheduledAt: new Date(row.scheduled_at as string),
      homeTeamExternalId: row.home_team_external_id as number | null,
      homeTeamName: row.home_team_name as string,
      homeTeamShortName: row.home_team_short_name as string,
      homeTeamTla: row.home_team_tla as string,
      homeTeamCrest: (row.home_team_crest as string | null) ?? null,
      awayTeamExternalId: row.away_team_external_id as number | null,
      awayTeamName: row.away_team_name as string,
      awayTeamShortName: row.away_team_short_name as string,
      awayTeamTla: row.away_team_tla as string,
      awayTeamCrest: (row.away_team_crest as string | null) ?? null,
      bracketSlot: (row.bracket_slot as string | null) ?? null,
      matchupDescription: (row.matchup_description as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Convert a MatchImportRecord (camelCase) to a DB row object (snake_case).
   */
  private toDbRow(record: MatchImportRecord): Record<string, unknown> {
    return {
      external_id: record.externalId ?? null,
      stage: record.stage,
      group: record.group,
      matchday: record.matchday,
      status: record.status,
      scheduled_at: record.scheduledAt,
      home_team_external_id: record.homeTeamExternalId ?? null,
      home_team_name: record.homeTeamName,
      home_team_short_name: record.homeTeamShortName,
      home_team_tla: record.homeTeamTla,
      home_team_crest: record.homeTeamCrest,
      away_team_external_id: record.awayTeamExternalId ?? null,
      away_team_name: record.awayTeamName,
      away_team_short_name: record.awayTeamShortName,
      away_team_tla: record.awayTeamTla,
      away_team_crest: record.awayTeamCrest,
      bracket_slot: record.bracketSlot ?? null,
      matchup_description: record.matchupDescription ?? null,
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

  /**
   * Return all matches (all stages) ordered by scheduled_at.
   * Returns [] if the table is empty or data is null.
   * Throws on Supabase error.
   */
  async findAllMatches(): Promise<Match[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .order('scheduled_at')

    if (error) {
      throw new Error(`findAllMatches failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return data.map((row) => this.toMatch(row as Record<string, unknown>))
  }

  /**
   * Upsert knockout placeholder rows keyed on bracket_slot.
   * Returns the number of records submitted for upsert.
   * Throws on Supabase error.
   */
  async upsertKnockoutPlaceholders(records: KnockoutPlaceholderRecord[]): Promise<number> {
    await this.verifySchema()

    const rows = records.map((r) => ({
      bracket_slot: r.bracketSlot,
      matchup_description: r.matchupDescription,
      stage: r.stage,
      group: '',
      matchday: r.matchday,
      status: 'SCHEDULED',
      scheduled_at: r.scheduledAt,
      home_team_name: r.homeTeamName,
      home_team_short_name: r.homeTeamShortName,
      home_team_tla: r.homeTeamTla,
      away_team_name: r.awayTeamName,
      away_team_short_name: r.awayTeamShortName,
      away_team_tla: r.awayTeamTla,
      home_team_crest: null,
      away_team_crest: null,
      external_id: null,
      home_team_external_id: null,
      away_team_external_id: null,
    }))

    const { error } = await this.supabase
      .from('matches')
      .upsert(rows, { onConflict: 'bracket_slot', ignoreDuplicates: false })

    if (error) {
      throw new Error(`upsertKnockoutPlaceholders failed: ${error.message}`)
    }

    return rows.length
  }

  /**
   * Update team details on knockout placeholder matches, matched positionally
   * within each stage by scheduled_at order.
   *
   * The football-data.org API may use matchday values that differ from our
   * seeded values, so we avoid matching on matchday entirely. Instead:
   * 1. Group API records by stage, sort each group by scheduledAt.
   * 2. For each stage, fetch our placeholder bracket_slots ordered by scheduled_at.
   * 3. Pair them positionally and update each by bracket_slot.
   *
   * Returns the count of records updated.
   * Throws on Supabase error.
   */
  async updateKnockoutTeams(records: MatchImportRecord[]): Promise<number> {
    await this.verifySchema()

    // Group API records by stage, sorted by scheduledAt within each stage
    const byStage = new Map<string, MatchImportRecord[]>()
    for (const record of records) {
      const stageRecords = byStage.get(record.stage) ?? []
      stageRecords.push(record)
      byStage.set(record.stage, stageRecords)
    }
    for (const stageRecords of byStage.values()) {
      stageRecords.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }

    let updated = 0

    for (const [stage, stageRecords] of byStage.entries()) {
      // Fetch placeholder bracket_slots for this stage ordered by scheduled_at
      const { data, error: fetchError } = await this.supabase
        .from('matches')
        .select('bracket_slot')
        .eq('stage', stage)
        .not('bracket_slot', 'is', null)
        .order('scheduled_at')

      if (fetchError) {
        throw new Error(`updateKnockoutTeams failed: ${fetchError.message}`)
      }

      const placeholders = (data ?? []) as { bracket_slot: string }[]

      for (let i = 0; i < Math.min(stageRecords.length, placeholders.length); i++) {
        const record = stageRecords[i]
        const { bracket_slot } = placeholders[i]

        const { error } = await this.supabase
          .from('matches')
          .update({
            external_id: record.externalId ?? null,
            home_team_external_id: record.homeTeamExternalId ?? null,
            home_team_name: record.homeTeamName,
            home_team_short_name: record.homeTeamShortName,
            home_team_tla: record.homeTeamTla,
            home_team_crest: record.homeTeamCrest,
            away_team_external_id: record.awayTeamExternalId ?? null,
            away_team_name: record.awayTeamName,
            away_team_short_name: record.awayTeamShortName,
            away_team_tla: record.awayTeamTla,
            away_team_crest: record.awayTeamCrest,
            status: record.status,
          })
          .eq('bracket_slot', bracket_slot)

        if (error) {
          throw new Error(`updateKnockoutTeams failed: ${error.message}`)
        }
        updated++
      }
    }

    return updated
  }
}
