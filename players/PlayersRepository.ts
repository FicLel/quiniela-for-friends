/**
 * PlayersRepository — Infrastructure adapter for the players sync feature.
 *
 * Implements IPlayersRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as
 * CompetitionsRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the players table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  IPlayersRepository,
  Player,
  PlayerDbRow,
  SyncRun,
  SyncRunItem,
} from '@/players/players.types'

export class PlayersRepository implements IPlayersRepository {
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
   * Lazily verifies that `public.players` exists in the database.
   * The check is performed at most once per repository instance — subsequent
   * calls reuse the cached Promise so there is no repeated round-trip.
   *
   * Throws:
   *   Error: Supabase table "public.players" does not exist — run pending migrations before starting the application.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('players')
          .select('id')
          .limit(0)

        if (error) {
          throw new Error(
            'Supabase table "public.players" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  /**
   * Map a raw Supabase row (snake_case) to the Player domain type.
   */
  private toPlayer(row: Record<string, unknown>): Player {
    return {
      id: row.id as string,
      providerPlayerId: row.provider_player_id as number,
      teamExternalId: row.team_external_id as number,
      name: row.name as string,
      position: (row.position as string | null) ?? null,
      shirtNumber: (row.shirt_number as number | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Map a raw Supabase row (snake_case) to the SyncRun domain type.
   */
  private toSyncRun(row: Record<string, unknown>): SyncRun {
    return {
      id: row.id as string,
      status: row.status as 'in_progress' | 'completed' | 'failed',
      startedAt: new Date(row.started_at as string),
      finishedAt: row.finished_at ? new Date(row.finished_at as string) : null,
    }
  }

  /**
   * Map a raw Supabase row (snake_case) to the SyncRunItem domain type.
   */
  private toSyncRunItem(row: Record<string, unknown>): SyncRunItem {
    return {
      id: row.id as string,
      syncRunId: row.sync_run_id as string,
      teamExternalId: row.team_external_id as number,
      status: row.status as 'success' | 'error',
      playersUpserted: (row.players_upserted as number | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
    }
  }

  /**
   * Returns sorted distinct team_external_id values via the
   * get_distinct_team_external_ids() DB function.
   * Returns [] if the matches table is empty or has no team IDs.
   * Throws on Supabase error.
   */
  async getDistinctTeamExternalIds(): Promise<number[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase.rpc('get_distinct_team_external_ids')

    if (error) {
      throw new Error(`getDistinctTeamExternalIds failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Array<{ team_external_id: number }>).map((row) => row.team_external_id)
  }

  /**
   * Upsert player rows keyed on provider_player_id.
   * Returns the number of rows submitted.
   * Throws on Supabase error.
   */
  async upsertPlayers(players: PlayerDbRow[]): Promise<number> {
    await this.verifySchema()

    const rows = players.map((p) => ({
      provider_player_id: p.providerPlayerId,
      team_external_id: p.teamExternalId,
      name: p.name,
      position: p.position ?? null,
      shirt_number: p.shirtNumber ?? null,
    }))

    const { error } = await this.supabase
      .from('players')
      .upsert(rows, { onConflict: 'provider_player_id', ignoreDuplicates: false })

    if (error) {
      throw new Error(`upsertPlayers failed: ${error.message}`)
    }

    return players.length
  }

  /**
   * Create a new sync_run record with status = 'in_progress'.
   * Throws on Supabase error or if the insert returns no data.
   */
  async createSyncRun(): Promise<SyncRun> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('sync_runs')
      .insert({ status: 'in_progress' })
      .select()
      .single()

    if (error) {
      throw new Error(`createSyncRun failed: ${error.message}`)
    }

    return this.toSyncRun(data as Record<string, unknown>)
  }

  /**
   * Update the status and finished_at of an existing sync_run.
   * Throws on Supabase error.
   */
  async updateSyncRun(
    syncRunId: string,
    status: 'completed' | 'failed',
    finishedAt: Date,
  ): Promise<void> {
    await this.verifySchema()

    const { error } = await this.supabase
      .from('sync_runs')
      .update({ status, finished_at: finishedAt.toISOString() })
      .eq('id', syncRunId)

    if (error) {
      throw new Error(`updateSyncRun failed: ${error.message}`)
    }
  }

  /**
   * Insert a sync_run_items record.
   * Throws on Supabase error.
   */
  async createSyncRunItem(item: {
    syncRunId: string
    teamExternalId: number
    status: 'success' | 'error'
    playersUpserted?: number
    errorMessage?: string
  }): Promise<void> {
    await this.verifySchema()

    const { error } = await this.supabase.from('sync_run_items').insert({
      sync_run_id: item.syncRunId,
      team_external_id: item.teamExternalId,
      status: item.status,
      players_upserted: item.playersUpserted ?? null,
      error_message: item.errorMessage ?? null,
    })

    if (error) {
      throw new Error(`createSyncRunItem failed: ${error.message}`)
    }
  }

  /**
   * Return all players belonging to the given team external IDs, ordered by name.
   * Returns [] immediately if teamExternalIds is empty (no DB call).
   * Throws on Supabase error.
   */
  async findByTeamExternalIds(teamExternalIds: number[]): Promise<Player[]> {
    if (teamExternalIds.length === 0) return []

    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('players')
      .select('*')
      .in('team_external_id', teamExternalIds)
      .order('name')

    if (error) {
      throw new Error(`findByTeamExternalIds failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toPlayer(row))
  }

  /**
   * Return the active in_progress sync run, or null if none exists.
   * Runs started more than 30 minutes ago are treated as stale and return null.
   */
  async getActiveSync(): Promise<SyncRun | null> {
    await this.verifySchema()

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    const { data } = await this.supabase
      .from('sync_runs')
      .select('*')
      .eq('status', 'in_progress')
      .gte('started_at', thirtyMinutesAgo.toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data ? this.toSyncRun(data as Record<string, unknown>) : null
  }
}
