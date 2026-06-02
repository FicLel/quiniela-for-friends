/**
 * players.types.ts — Domain types, DTOs, and port interfaces for the players
 * module (World Cup player sync).
 */

// ---------------------------------------------------------------------------
// Provider shapes (football-data.org API response)
// ---------------------------------------------------------------------------

export type ProviderSquadMember = {
  id: number
  name: string
  position: string | null
  shirtNumber: number | null
}

export type ProviderTeamDetailResponse = {
  id: number
  name: string
  squad: ProviderSquadMember[]
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Player = {
  id: string
  providerPlayerId: number
  teamExternalId: number
  name: string
  position: string | null
  shirtNumber: number | null
  createdAt: Date
  updatedAt: Date
}

/** Input shape for upsert operations (no id/timestamps — DB generates those). */
export type PlayerDbRow = {
  providerPlayerId: number
  teamExternalId: number
  name: string
  position: string | null
  shirtNumber: number | null
}

export type SyncRun = {
  id: string
  status: 'in_progress' | 'completed' | 'failed'
  startedAt: Date
  finishedAt: Date | null
}

export type SyncRunItem = {
  id: string
  syncRunId: string
  teamExternalId: number
  status: 'success' | 'error'
  playersUpserted: number | null
  errorMessage: string | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Repository interface (port)
// ---------------------------------------------------------------------------

export interface IPlayersRepository {
  /** Returns sorted list of distinct team_external_id values from the matches table. */
  getDistinctTeamExternalIds(): Promise<number[]>

  /**
   * Upsert player rows keyed on provider_player_id.
   * Returns the number of rows submitted (not necessarily inserted/updated).
   */
  upsertPlayers(players: PlayerDbRow[]): Promise<number>

  /** Create a new sync_run record with status = 'in_progress'. */
  createSyncRun(): Promise<SyncRun>

  /** Update the status and finished_at of an existing sync_run. */
  updateSyncRun(syncRunId: string, status: 'completed' | 'failed', finishedAt: Date): Promise<void>

  /** Insert a sync_run_items record. */
  createSyncRunItem(item: {
    syncRunId: string
    teamExternalId: number
    status: 'success' | 'error'
    playersUpserted?: number
    errorMessage?: string
  }): Promise<void>

  /**
   * Return the active (in_progress) sync run, or null if none exists.
   * Runs older than 30 minutes are treated as stale and return null.
   */
  getActiveSync(): Promise<SyncRun | null>
}

// ---------------------------------------------------------------------------
// Route response shapes (discriminated unions)
// ---------------------------------------------------------------------------

export type SyncStartResponse =
  | { success: true; syncRunId: string; teamIds: number[] }
  | { success: false; error: 'SYNC_IN_PROGRESS' | 'DB_ERROR' | 'UNAUTHORIZED' }

export type TeamDetailResponse =
  | { success: true; squad: ProviderSquadMember[] }
  | { success: false; error: 'FETCH_FAILED' | 'UNAUTHORIZED' | 'MISSING_PARAM' }

export type SaveTeamBody = {
  syncRunId: string
  teamExternalId: number
  players: PlayerDbRow[]
}

export type SaveTeamResponse =
  | { success: true; playersUpserted: number }
  | { success: false; error: 'DB_ERROR' | 'INVALID_PAYLOAD' | 'UNAUTHORIZED' }

export type SyncFinishBody = {
  syncRunId: string
  status: 'completed' | 'failed'
}

export type SyncFinishResponse =
  | { success: true }
  | { success: false; error: 'DB_ERROR' | 'INVALID_PAYLOAD' | 'UNAUTHORIZED' }

export type SyncItemErrorBody = {
  syncRunId: string
  teamExternalId: number
  errorMessage: string
}

export type SyncItemErrorResponse =
  | { success: true }
  | { success: false; error: 'DB_ERROR' | 'INVALID_PAYLOAD' | 'UNAUTHORIZED' }
