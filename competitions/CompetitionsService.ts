/**
 * CompetitionsService — Application-layer service for World Cup match import.
 *
 * Contains all business logic for the match import use case. Depends on
 * ICompetitionsClient and ICompetitionsRepository through its constructor
 * so both can be swapped with test doubles.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected client and repository.
 */

import type {
  ICompetitionsClient,
  ICompetitionsRepository,
  ICompetitionsService,
  ImportMatchesResult,
  KnockoutPlaceholderRecord,
  Match,
  SeedPlaceholdersResult,
  SyncResultPayload,
  SyncRegulationResultsResult,
} from '@/competitions/competitions.types'
import type { IScoringService } from '@/scoring/scoring.types'

// ---------------------------------------------------------------------------
// Knockout bracket seed data — 32 records (16 R32 + 8 R16 + 4 QF + 2 SF + 1 3P + 1 F)
// ---------------------------------------------------------------------------

const KNOCKOUT_PLACEHOLDER_DATA: KnockoutPlaceholderRecord[] = [
  // Round of 32 — 16 matches (FIFA WC 2026 official bracket, real UTC kickoff times)
  // Sorted by scheduled_at so positional pairing in updateKnockoutTeams() is correct.
  // R32_01+R32_03 → R16_01 | R32_02+R32_05 → R16_02 | R32_04+R32_06 → R16_03
  // R32_07+R32_08 → R16_04 | R32_09+R32_10 → R16_06 | R32_11+R32_12 → R16_05
  // R32_13+R32_15 → R16_08 | R32_14+R32_16 → R16_07
  { bracketSlot: 'R32_01', matchupDescription: 'Group A Runner-up vs Group B Runner-up', stage: 'ROUND_OF_32', matchday: 1, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-28T19:00:00Z' },
  { bracketSlot: 'R32_04', matchupDescription: 'Group C Winner vs Group F Runner-up', stage: 'ROUND_OF_32', matchday: 4, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-29T17:00:00Z' },
  { bracketSlot: 'R32_02', matchupDescription: 'Group E Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 2, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-29T20:30:00Z' },
  { bracketSlot: 'R32_03', matchupDescription: 'Group F Winner vs Group C Runner-up', stage: 'ROUND_OF_32', matchday: 3, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-30T01:00:00Z' },
  { bracketSlot: 'R32_06', matchupDescription: 'Group E Runner-up vs Group I Runner-up', stage: 'ROUND_OF_32', matchday: 6, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-30T17:00:00Z' },
  { bracketSlot: 'R32_05', matchupDescription: 'Group I Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 5, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-06-30T21:00:00Z' },
  { bracketSlot: 'R32_07', matchupDescription: 'Group A Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 7, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-01T01:00:00Z' },
  { bracketSlot: 'R32_08', matchupDescription: 'Group L Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 8, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-01T16:00:00Z' },
  { bracketSlot: 'R32_10', matchupDescription: 'Group G Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 10, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-01T20:00:00Z' },
  { bracketSlot: 'R32_09', matchupDescription: 'Group D Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 9, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-02T00:00:00Z' },
  { bracketSlot: 'R32_12', matchupDescription: 'Group H Winner vs Group J Runner-up', stage: 'ROUND_OF_32', matchday: 12, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-02T19:00:00Z' },
  { bracketSlot: 'R32_11', matchupDescription: 'Group K Runner-up vs Group L Runner-up', stage: 'ROUND_OF_32', matchday: 11, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-02T23:00:00Z' },
  { bracketSlot: 'R32_13', matchupDescription: 'Group B Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 13, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-03T03:00:00Z' },
  { bracketSlot: 'R32_16', matchupDescription: 'Group D Runner-up vs Group G Runner-up', stage: 'ROUND_OF_32', matchday: 16, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-03T18:00:00Z' },
  { bracketSlot: 'R32_14', matchupDescription: 'Group J Winner vs Group H Runner-up', stage: 'ROUND_OF_32', matchday: 14, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-03T22:00:00Z' },
  { bracketSlot: 'R32_15', matchupDescription: 'Group K Winner vs Best 3rd Place', stage: 'ROUND_OF_32', matchday: 15, homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD', scheduledAt: '2026-07-04T01:30:00Z' },
  // Round of 16 — 8 matches (real UTC times; matchupDescriptions use actual bracket pairings)
  { bracketSlot: 'R16_01', matchupDescription: 'Winner R32_01 vs Winner R32_03', stage: 'ROUND_OF_16', matchday: 1, scheduledAt: '2026-07-04T17:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_02', matchupDescription: 'Winner R32_02 vs Winner R32_05', stage: 'ROUND_OF_16', matchday: 2, scheduledAt: '2026-07-04T21:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_03', matchupDescription: 'Winner R32_04 vs Winner R32_06', stage: 'ROUND_OF_16', matchday: 3, scheduledAt: '2026-07-05T20:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_04', matchupDescription: 'Winner R32_07 vs Winner R32_08', stage: 'ROUND_OF_16', matchday: 4, scheduledAt: '2026-07-06T00:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_05', matchupDescription: 'Winner R32_11 vs Winner R32_12', stage: 'ROUND_OF_16', matchday: 5, scheduledAt: '2026-07-06T19:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_06', matchupDescription: 'Winner R32_09 vs Winner R32_10', stage: 'ROUND_OF_16', matchday: 6, scheduledAt: '2026-07-07T00:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_07', matchupDescription: 'Winner R32_14 vs Winner R32_16', stage: 'ROUND_OF_16', matchday: 7, scheduledAt: '2026-07-07T16:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'R16_08', matchupDescription: 'Winner R32_13 vs Winner R32_15', stage: 'ROUND_OF_16', matchday: 8, scheduledAt: '2026-07-07T20:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  // Quarter-finals — 4 matches
  { bracketSlot: 'QF_01', matchupDescription: 'Winner R16_01 vs Winner R16_02', stage: 'QUARTER_FINALS', matchday: 1, scheduledAt: '2026-07-09T20:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'QF_02', matchupDescription: 'Winner R16_05 vs Winner R16_06', stage: 'QUARTER_FINALS', matchday: 2, scheduledAt: '2026-07-10T19:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'QF_03', matchupDescription: 'Winner R16_03 vs Winner R16_04', stage: 'QUARTER_FINALS', matchday: 3, scheduledAt: '2026-07-11T21:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'QF_04', matchupDescription: 'Winner R16_07 vs Winner R16_08', stage: 'QUARTER_FINALS', matchday: 4, scheduledAt: '2026-07-12T01:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  // Semi-finals — 2 matches
  { bracketSlot: 'SF_01', matchupDescription: 'Winner QF_01 vs Winner QF_02', stage: 'SEMI_FINALS', matchday: 1, scheduledAt: '2026-07-14T19:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  { bracketSlot: 'SF_02', matchupDescription: 'Winner QF_03 vs Winner QF_04', stage: 'SEMI_FINALS', matchday: 2, scheduledAt: '2026-07-15T19:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  // Third-place play-off — 1 match
  { bracketSlot: '3P_01', matchupDescription: 'Loser SF_01 vs Loser SF_02', stage: 'THIRD_PLACE', matchday: 1, scheduledAt: '2026-07-18T21:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
  // Final — 1 match
  { bracketSlot: 'FINAL_01', matchupDescription: 'Winner SF_01 vs Winner SF_02', stage: 'FINAL', matchday: 1, scheduledAt: '2026-07-19T19:00:00Z', homeTeamName: 'TBD', homeTeamShortName: 'TBD', homeTeamTla: 'TBD', awayTeamName: 'TBD', awayTeamShortName: 'TBD', awayTeamTla: 'TBD' },
]

export class CompetitionsService implements ICompetitionsService {
  constructor(
    private readonly client: ICompetitionsClient,
    private readonly repository: ICompetitionsRepository,
    private readonly scoringService?: IScoringService,
  ) {}

  /**
   * Import World Cup group-stage matches from the external API into the DB.
   *
   * Flow:
   * 1. Fetch matches from the client.
   *    - If the client throws → { success: false, error: 'FETCH_FAILED' } (no DB write).
   * 2. Upsert records via the repository.
   *    - If the repository throws → { success: false, error: 'DB_ERROR' }.
   * 3. Any other unexpected throw → { success: false, error: 'UNKNOWN_ERROR' }.
   * 4. On success → { success: true, count } where count is the number of records upserted.
   */
  async getAllMatches(): Promise<Match[]> {
    return this.repository.findAllMatches()
  }

  async importGroupStageMatches(): Promise<ImportMatchesResult> {
    let records
    try {
      records = await this.client.fetchGroupStageMatches()
    } catch {
      return { success: false, error: 'FETCH_FAILED' }
    }

    let count: number
    try {
      count = await this.repository.upsertMatches(records)
    } catch {
      return { success: false, error: 'DB_ERROR' }
    }

    try {
      return { success: true, count }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Seed knockout bracket placeholder matches into the DB.
   *
   * Flow:
   * 1. Upsert all 32 KNOCKOUT_PLACEHOLDER_DATA records via the repository.
   *    - If the repository throws → { success: false, error: 'DB_ERROR' }.
   * 2. Any other unexpected throw → { success: false, error: 'UNKNOWN_ERROR' }.
   * 3. On success → { success: true, count } where count is the number of records upserted.
   */
  async seedKnockoutPlaceholders(): Promise<SeedPlaceholdersResult> {
    let count: number
    try {
      count = await this.repository.upsertKnockoutPlaceholders(KNOCKOUT_PLACEHOLDER_DATA)
    } catch {
      return { success: false, error: 'DB_ERROR' }
    }

    try {
      return { success: true, count }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Sync knockout match team details from the external API into the DB.
   *
   * Flow:
   * 1. Fetch knockout matches from the client.
   *    - If the client throws → { success: false, error: 'FETCH_FAILED' }.
   * 2. Update rows via the repository.
   *    - If the repository throws → { success: false, error: 'DB_ERROR' }.
   * 3. Any other unexpected throw → { success: false, error: 'UNKNOWN_ERROR' }.
   * 4. On success → { success: true, count }.
   */
  async syncKnockoutMatches(): Promise<ImportMatchesResult> {
    let records
    try {
      records = await this.client.fetchAllKnockoutMatches()
    } catch {
      return { success: false, error: 'FETCH_FAILED' }
    }

    let count: number
    try {
      count = await this.repository.updateKnockoutTeams(records)
    } catch {
      return { success: false, error: 'DB_ERROR' }
    }

    try {
      return { success: true, count }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Update regulation-time results for a batch of matches and recalculate
   * prediction scores for each one.
   *
   * Flow:
   * For each entry in the payload:
   *   1. Call repository.updateRegulationResults(matchId, homeGoals, awayGoals).
   *   2. If scoringService is provided, call scoringService.recalculateMatchScores(matchId).
   * Any DB-level throw → { success: false, error: 'DB_ERROR' }.
   * On success → { success: true, matchesUpdated, scoresUpdated }.
   */
  async syncRegulationResults(payload: SyncResultPayload[]): Promise<SyncRegulationResultsResult> {
    let scoresUpdated = 0
    try {
      for (const entry of payload) {
        await this.repository.updateRegulationResults(
          entry.matchId,
          entry.regulationHomeGoals,
          entry.regulationAwayGoals,
        )
        if (this.scoringService) {
          await this.scoringService.recalculateMatchScores(entry.matchId)
          scoresUpdated++
        }
      }
    } catch {
      return { success: false, error: 'DB_ERROR' }
    }

    return {
      success: true,
      matchesUpdated: payload.length,
      scoresUpdated,
    }
  }
}
