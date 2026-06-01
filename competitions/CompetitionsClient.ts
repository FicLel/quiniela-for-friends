/**
 * CompetitionsClient — Infrastructure adapter for the football-data.org v4 API.
 *
 * Fetches World Cup (WC) group-stage match data and maps raw responses to
 * the MatchImportRecord DTO. Only GROUP_STAGE matches are returned; all
 * other stages and fields (score, referees, odds, goals) are discarded.
 *
 * Authentication: X-Auth-Token header populated from FOOTBALL_DATA_ORG_API_KEY.
 * Throws a typed CompetitionsClientError on non-2xx responses or network failures.
 */

import type { ICompetitionsClient, MatchImportRecord } from '@/competitions/competitions.types'

const WC_MATCHES_URL =
  'https://api.football-data.org/v4/competitions/WC/matches?season=2026'

// ---------------------------------------------------------------------------
// requireEnv — same pattern as auth/AuthClient.ts
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[CompetitionsClient] Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in the value.`,
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// Raw API shape (only the fields we care about)
// ---------------------------------------------------------------------------

type RawTeam = {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string | null
}

type RawMatch = {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string
  matchday: number
  homeTeam: RawTeam
  awayTeam: RawTeam
}

type RawApiResponse = {
  matches: RawMatch[]
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const KNOCKOUT_STAGES = [
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]

export class CompetitionsClient implements ICompetitionsClient {
  /**
   * Fetch all GROUP_STAGE matches for the 2026 World Cup.
   *
   * Throws:
   *   Error — on non-2xx HTTP response (message includes status code)
   *   Error — on network failure (message from underlying fetch error)
   *   Error — when FOOTBALL_DATA_ORG_API_KEY env var is missing
   */
  async fetchGroupStageMatches(): Promise<MatchImportRecord[]> {
    const apiKey = requireEnv('FOOTBALL_DATA_ORG_API_KEY')

    let response: Response
    try {
      response = await fetch(WC_MATCHES_URL, {
        headers: {
          'X-Auth-Token': apiKey,
        },
      })
    } catch (err) {
      throw new Error(
        `[CompetitionsClient] Network failure fetching matches: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `[CompetitionsClient] Unexpected response from football-data.org: HTTP ${response.status}`,
      )
    }

    const body = (await response.json()) as RawApiResponse

    return body.matches
      .filter((m) => m.stage === 'GROUP_STAGE')
      .map((m) => mapToImportRecord(m))
  }

  /**
   * Fetch all knockout-stage matches for the 2026 World Cup.
   * Filters for ROUND_OF_32, ROUND_OF_16, QUARTER_FINALS, SEMI_FINALS,
   * THIRD_PLACE, and FINAL stages.
   *
   * Throws:
   *   Error — on non-2xx HTTP response (message includes status code)
   *   Error — on network failure (message from underlying fetch error)
   *   Error — when FOOTBALL_DATA_ORG_API_KEY env var is missing
   */
  async fetchAllKnockoutMatches(): Promise<MatchImportRecord[]> {
    const apiKey = requireEnv('FOOTBALL_DATA_ORG_API_KEY')

    let response: Response
    try {
      response = await fetch(WC_MATCHES_URL, {
        headers: {
          'X-Auth-Token': apiKey,
        },
      })
    } catch (err) {
      throw new Error(
        `[CompetitionsClient] Network failure fetching matches: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `[CompetitionsClient] Unexpected response from football-data.org: HTTP ${response.status}`,
      )
    }

    const body = (await response.json()) as RawApiResponse

    return body.matches
      .filter((m) => KNOCKOUT_STAGES.includes(m.stage))
      .map((m) => mapToImportRecord(m))
  }
}

function mapToImportRecord(m: RawMatch): MatchImportRecord {
  return {
    externalId: m.id,
    stage: m.stage,
    group: m.group,
    matchday: m.matchday,
    status: m.status,
    scheduledAt: m.utcDate,
    homeTeamExternalId: m.homeTeam.id,
    homeTeamName: m.homeTeam.name,
    homeTeamShortName: m.homeTeam.shortName,
    homeTeamTla: m.homeTeam.tla,
    homeTeamCrest: m.homeTeam.crest ?? null,
    awayTeamExternalId: m.awayTeam.id,
    awayTeamName: m.awayTeam.name,
    awayTeamShortName: m.awayTeam.shortName,
    awayTeamTla: m.awayTeam.tla,
    awayTeamCrest: m.awayTeam.crest ?? null,
  }
}
