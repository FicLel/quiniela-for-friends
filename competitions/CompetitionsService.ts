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
} from '@/competitions/competitions.types'

export class CompetitionsService implements ICompetitionsService {
  constructor(
    private readonly client: ICompetitionsClient,
    private readonly repository: ICompetitionsRepository,
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
}
