/**
 * competitions.types.ts — Domain types, DTOs, and port interfaces for the
 * competitions module (World Cup match import and query).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Domain object returned by the repository — fully mapped from snake_case DB rows. */
export type Match = {
  id: string
  externalId: number | null
  stage: string
  group: string
  matchday: number
  status: string
  scheduledAt: Date
  homeTeamExternalId: number | null
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  homeTeamCrest: string | null
  awayTeamExternalId: number | null
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
  bracketSlot: string | null
  matchupDescription: string | null
  regulationHomeGoals: number | null
  regulationAwayGoals: number | null
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Flattened DTO used for upsert operations.
 * camelCase field names — mirrors DB columns.
 * Produced by CompetitionsClient; consumed by CompetitionsRepository.
 */
export type MatchImportRecord = {
  externalId: number | null
  stage: string
  group: string
  matchday: number
  status: string
  scheduledAt: string        // ISO 8601 UTC string from API
  homeTeamExternalId: number | null
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  homeTeamCrest: string | null
  awayTeamExternalId: number | null
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
  bracketSlot?: string | null
  matchupDescription?: string | null
}

/**
 * Record used when seeding knockout placeholder matches.
 * All team fields are 'TBD' until the real teams are known.
 */
export type KnockoutPlaceholderRecord = {
  bracketSlot: string
  matchupDescription: string
  stage: string
  matchday: number
  scheduledAt: string  // ISO 8601
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
}

// ---------------------------------------------------------------------------
// Result types (discriminated unions)
// ---------------------------------------------------------------------------

export type ImportMatchesResult =
  | { success: true; count: number }
  | { success: false; error: 'FETCH_FAILED' | 'DB_ERROR' | 'UNKNOWN_ERROR' }

export type SeedPlaceholdersResult =
  | { success: true; count: number }
  | { success: false; error: 'DB_ERROR' | 'UNKNOWN_ERROR' }

export type SyncResultPayload = {
  matchId: string
  regulationHomeGoals: number
  regulationAwayGoals: number
}

export type SyncRegulationResultsResult =
  | { success: true; matchesUpdated: number; scoresUpdated: number }
  | { success: false; error: 'UNAUTHORIZED' | 'INVALID_PAYLOAD' | 'DB_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface ICompetitionsClient {
  /** Fetch all GROUP_STAGE matches for the 2026 World Cup from football-data.org. */
  fetchGroupStageMatches(): Promise<MatchImportRecord[]>
  /** Fetch all knockout-stage matches for the 2026 World Cup from football-data.org. */
  fetchAllKnockoutMatches(): Promise<MatchImportRecord[]>
}

export interface ICompetitionsRepository {
  /**
   * Upsert match records into public.matches, keyed on external_id.
   * Returns the number of records submitted (not necessarily inserted/updated).
   */
  upsertMatches(records: MatchImportRecord[]): Promise<number>

  /** Return all matches ordered by group → matchday → scheduled_at. */
  findAllGroupStageMatches(): Promise<Match[]>

  /** Return all matches (all stages) ordered by scheduled_at. */
  findAllMatches(): Promise<Match[]>

  /**
   * Upsert knockout placeholder rows, keyed on bracket_slot.
   * Returns the number of records submitted.
   */
  upsertKnockoutPlaceholders(records: KnockoutPlaceholderRecord[]): Promise<number>

  /**
   * Update team details on knockout matches that have a bracket_slot,
   * matched by stage + matchday.
   * Returns the count of records processed.
   */
  updateKnockoutTeams(records: MatchImportRecord[]): Promise<number>

  /** Return a single match by its primary key UUID, or null if not found. */
  findById(matchId: string): Promise<Match | null>

  /**
   * Set regulation_home_goals, regulation_away_goals, and last_synced_at = NOW()
   * for the given match.
   */
  updateRegulationResults(matchId: string, homeGoals: number, awayGoals: number): Promise<void>

  /** Return the scheduled_at timestamp for the given match, or null if not found. */
  findKickoffAt(matchId: string): Promise<Date | null>

  /**
   * Return true if at least one match row exists in the matches table.
   * Used to gate feature creation that requires competition data.
   */
  hasAnyMatches(): Promise<boolean>

  /**
   * Return all distinct teams from the matches table, deduplicated by externalId.
   * Returns [] if no matches exist or all team external IDs are null.
   * Sorted alphabetically by name.
   */
  findDistinctTeams(): Promise<{ name: string; externalId: number }[]>
}

export interface ICompetitionsService {
  importGroupStageMatches(): Promise<ImportMatchesResult>
  getAllMatches(): Promise<Match[]>
  seedKnockoutPlaceholders(): Promise<SeedPlaceholdersResult>
  syncKnockoutMatches(): Promise<ImportMatchesResult>
  syncRegulationResults(payload: SyncResultPayload[]): Promise<SyncRegulationResultsResult>
}
