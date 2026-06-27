/**
 * TournamentBracketService — Application-layer orchestrator for the
 * tournament bracket view.
 *
 * Flow for getBracketForMember(quinielaId, userId):
 *   1. Access gate — caller must be an APPROVED member of the quiniela
 *      (membershipsRepository.isApprovedMember). Non-members get
 *      NOT_APPROVED_MEMBER with no bracket data computed or returned.
 *   2. Layer 1 (shared, quiniela-agnostic): group projections + cascade-
 *      resolved team names. Rebuilt at most once per 30s TTL window; reused
 *      across every quiniela and every member while fresh.
 *   3. Layer 2 (per quiniela+user): the merged bracket+prediction view.
 *      Rebuilt at most once per 30s TTL window per (quinielaId, userId) pair.
 *   4. Predictions are read according to the app's global PredictionMode
 *      (see appSettings.types.ts), mirroring the branch already used by
 *      app/[lang]/(private)/welcome/page.tsx:
 *        - 'shared'        -> predictionsReader.getExpectedResultsForUser(userId)
 *          — one prediction per match, shared across every quiniela
 *          (quiniela_id IS NULL in the DB; querying findByUserIdAndQuiniela
 *          with a real quinielaId would incorrectly return nothing in this mode).
 *        - 'per_quiniela'  -> predictionsReader.findByUserIdAndQuiniela(userId, quinielaId).
 *      If the settings lookup itself fails, 'shared' is used as the safe
 *      default — matching the welcome page's fallback.
 *   5. Merge: every knockout match (R32→Final) becomes a MatchupCard,
 *      annotated with the member's own prediction (if any) and the
 *      confirmed result (if the match has synced regulation goals).
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js.
 * - All I/O goes through the injected repositories; caching goes through the
 *   injected TournamentBracketCache instance (defaults to the shared
 *   module-level singleton, matching the pattern used elsewhere — see
 *   PredictionScoreRepository's module-level playerPredictionsCache).
 */

import type { Match } from '@/competitions/competitions.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'
import {
  tournamentBracketCache,
  type TournamentBracketCache,
} from '@/tournaments/TournamentBracketCache'
import type {
  BracketStage,
  BracketStageGroup,
  BracketView,
  GetBracketResult,
  IBracketCascadeService,
  IGroupProjectionService,
  IMatchesReader,
  IPredictionModeReader,
  IPredictionsReader,
  ITournamentBracketService,
  MatchupCard,
} from '@/tournaments/tournaments.types'

const KNOCKOUT_STAGES: BracketStage[] = [
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]

export class TournamentBracketService implements ITournamentBracketService {
  constructor(
    private readonly matchesReader: IMatchesReader,
    private readonly predictionsReader: IPredictionsReader,
    private readonly membershipsRepository: IMembershipsRepository,
    private readonly groupProjectionService: IGroupProjectionService,
    private readonly cascadeService: IBracketCascadeService,
    private readonly predictionModeReader: IPredictionModeReader,
    private readonly cache: TournamentBracketCache = tournamentBracketCache,
  ) {}

  async getBracketForMember(quinielaId: string, userId: string): Promise<GetBracketResult> {
    try {
      const isApproved = await this.membershipsRepository.isApprovedMember(quinielaId, userId)
      if (!isApproved) {
        return { success: false, error: 'NOT_APPROVED_MEMBER' }
      }

      const cachedLayer2 = this.cache.getLayer2(quinielaId, userId)
      if (cachedLayer2) {
        return { success: true, bracket: cachedLayer2 }
      }

      let matches: Match[]
      try {
        matches = await this.matchesReader.findAllMatches()
      } catch {
        return { success: false, error: 'FETCH_FAILED' }
      }

      const layer1 = this.getOrBuildLayer1(matches)

      const predictions = await this.readPredictionsForActiveMode(quinielaId, userId)
      const predictionByMatchId = new Map(
        predictions.map((p) => [p.matchId, { homeScore: p.homeScore, awayScore: p.awayScore }]),
      )

      const bracket = this.buildBracketView(quinielaId, matches, layer1, predictionByMatchId)

      this.cache.setLayer2(quinielaId, userId, bracket)

      return { success: true, bracket }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Read the member's predictions using the branch appropriate to the
   * app's active global PredictionMode — mirrors the logic in
   * app/[lang]/(private)/welcome/page.tsx:
   *   - 'per_quiniela' -> predictions are scoped per quiniela; read via
   *     findByUserIdAndQuiniela(userId, quinielaId).
   *   - 'shared' (including the safe-default fallback when settings can't
   *     be read) -> predictions have quiniela_id IS NULL in the DB and
   *     apply uniformly across every quiniela the member belongs to; read
   *     via getExpectedResultsForUser(userId) — NOT findByUserIdAndQuiniela,
   *     which would filter on a real quinielaId and always return [] in
   *     this mode.
   */
  private async readPredictionsForActiveMode(
    quinielaId: string,
    userId: string,
  ): Promise<{ matchId: string; homeScore: number; awayScore: number }[]> {
    const settingsResult = await this.predictionModeReader.getSettings()
    const predictionMode = settingsResult.success ? settingsResult.settings.predictionMode : 'shared'

    if (predictionMode === 'per_quiniela') {
      return this.predictionsReader.findByUserIdAndQuiniela(userId, quinielaId)
    }

    return this.predictionsReader.getExpectedResultsForUser(userId)
  }

  /**
   * Return the cached Layer 1 skeleton if fresh, otherwise rebuild it from
   * the given matches and cache it.
   */
  private getOrBuildLayer1(matches: Match[]) {
    const cached = this.cache.getLayer1()
    if (cached) return cached

    const projections = this.groupProjectionService.projectGroups(matches)
    const resolvedTeamsByMatchId = this.cascadeService.resolveCascade(matches, projections)

    const skeleton = { projections, resolvedTeamsByMatchId }
    this.cache.setLayer1(skeleton)
    return skeleton
  }

  private buildBracketView(
    quinielaId: string,
    matches: Match[],
    layer1: { resolvedTeamsByMatchId: Map<string, { homeTeamName: string; awayTeamName: string }> },
    predictionByMatchId: Map<string, { homeScore: number; awayScore: number }>,
  ): BracketView {
    const knockoutMatches = matches.filter((m) =>
      KNOCKOUT_STAGES.includes(m.stage as BracketStage),
    )

    const cardsByStage = new Map<BracketStage, MatchupCard[]>()
    for (const stage of KNOCKOUT_STAGES) {
      cardsByStage.set(stage, [])
    }

    for (const match of knockoutMatches) {
      const stage = match.stage as BracketStage
      const resolved = layer1.resolvedTeamsByMatchId.get(match.id)

      const homeTeamName = resolved?.homeTeamName ?? match.homeTeamName
      const awayTeamName = resolved?.awayTeamName ?? match.awayTeamName
      const teamsResolved = homeTeamName !== 'TBD' && awayTeamName !== 'TBD'

      const prediction = predictionByMatchId.get(match.id) ?? null

      const result =
        match.regulationHomeGoals !== null && match.regulationAwayGoals !== null
          ? { homeGoals: match.regulationHomeGoals, awayGoals: match.regulationAwayGoals }
          : null

      const card: MatchupCard = {
        matchId: match.id,
        bracketSlot: match.bracketSlot,
        stage,
        matchupDescription: match.matchupDescription ?? `${homeTeamName} vs ${awayTeamName}`,
        homeTeamName,
        awayTeamName,
        teamsResolved,
        status: match.status,
        scheduledAt: match.scheduledAt.toISOString(),
        prediction,
        result,
      }

      cardsByStage.get(stage)?.push(card)
    }

    // Order matchups within each stage by scheduled time (tournament order).
    for (const cards of cardsByStage.values()) {
      cards.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }

    const stages: BracketStageGroup[] = KNOCKOUT_STAGES
      .map((stage) => ({ stage, matchups: cardsByStage.get(stage) ?? [] }))
      .filter((group) => group.matchups.length > 0)

    return { quinielaId, stages }
  }
}
