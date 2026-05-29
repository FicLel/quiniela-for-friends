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
  externalId: number
  stage: string
  group: string
  matchday: number
  status: string
  scheduledAt: Date
  homeTeamExternalId: number
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  homeTeamCrest: string | null
  awayTeamExternalId: number
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Flattened DTO used for upsert operations.
 * camelCase field names — mirrors DB columns.
 * Produced by CompetitionsClient; consumed by CompetitionsRepository.
 */
export type MatchImportRecord = {
  externalId: number
  stage: string
  group: string
  matchday: number
  status: string
  scheduledAt: string        // ISO 8601 UTC string from API
  homeTeamExternalId: number
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  homeTeamCrest: string | null
  awayTeamExternalId: number
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
}

// ---------------------------------------------------------------------------
// Result types (discriminated unions)
// ---------------------------------------------------------------------------

export type ImportMatchesResult =
  | { success: true; count: number }
  | { success: false; error: 'FETCH_FAILED' | 'DB_ERROR' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface ICompetitionsClient {
  /** Fetch all GROUP_STAGE matches for the 2026 World Cup from football-data.org. */
  fetchGroupStageMatches(): Promise<MatchImportRecord[]>
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
}

export interface ICompetitionsService {
  importGroupStageMatches(): Promise<ImportMatchesResult>
  getAllMatches(): Promise<Match[]>
}
