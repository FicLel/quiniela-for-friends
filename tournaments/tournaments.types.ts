/**
 * tournaments.types.ts — Domain types and port interfaces for the
 * tournaments module (knockout bracket view + group qualification
 * projection + cascade resolution of placeholder matchups).
 *
 * Nothing in this module is persisted: all types here describe purely
 * computed / derived views over the existing `matches` and
 * `user_expected_results` data exposed by the competitions and
 * expectedResults modules. See docs/architecture.md — services depend
 * only on ports, never on Supabase or Next.js directly.
 */

import type { Match } from '@/competitions/competitions.types'

// ---------------------------------------------------------------------------
// Group qualification projection
// ---------------------------------------------------------------------------

/** A team's qualification status for its group, fully resolved or still open. */
export type GroupQualificationStatus = 'QUALIFIED' | 'ELIMINATED' | 'UNDECIDED'

/** Slot a team is projected to occupy on exit from the group stage. */
export type GroupExitSlot = 'WINNER' | 'RUNNER_UP' | 'THIRD_PLACE' | 'NONE'

/** Per-team standing inside a group, after applying FIFA tiebreak order. */
export type TeamStanding = {
  teamName: string
  teamExternalId: number | null
  played: number
  points: number
  goalDifference: number
  goalsFor: number
  goalsAgainst: number
  /** Qualification outcome once all mathematically possible remaining results are enumerated. */
  status: GroupQualificationStatus
  /** Projected exit slot — only meaningful when status is 'QUALIFIED'. */
  projectedSlot: GroupExitSlot
}

/** Combinatorial group projection result for a single group. */
export type GroupProjection = {
  group: string
  standings: TeamStanding[]
  /** True once every remaining fixture in the group has been played. */
  isComplete: boolean
}

// ---------------------------------------------------------------------------
// Bracket view
// ---------------------------------------------------------------------------

export type BracketStage =
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL'

/** The member's own prediction for a matchup, when one has been submitted. */
export type MatchupPrediction = {
  homeScore: number
  awayScore: number
}

/** The confirmed regulation-time result for a played matchup. */
export type MatchupResult = {
  homeGoals: number
  awayGoals: number
}

/**
 * A single bracket card. Team names are either the real synced team name
 * (from football-data.org via CompetitionsService) or a cascade-resolved
 * derived name (display-only, never written back to `matches`), or the
 * original placeholder description when nothing can be resolved yet.
 */
export type MatchupCard = {
  matchId: string
  bracketSlot: string | null
  stage: BracketStage
  /** Human-readable matchup label, e.g. "Group A Winner vs Group B Runner-up" or real team names once resolved. */
  matchupDescription: string
  homeTeamName: string
  awayTeamName: string
  /** True once both team names are real (synced or cascade-resolved), not "TBD"/placeholder text. */
  teamsResolved: boolean
  status: string
  scheduledAt: string
  /** The viewing member's own prediction for this matchup, if any was submitted. */
  prediction: MatchupPrediction | null
  /** The confirmed result, present only once the match has synced regulation goals. */
  result: MatchupResult | null
}

export type BracketStageGroup = {
  stage: BracketStage
  matchups: MatchupCard[]
}

/** Full bracket view for one quiniela + one member, ready for the frontend to render. */
export type BracketView = {
  quinielaId: string
  stages: BracketStageGroup[]
}

// ---------------------------------------------------------------------------
// Service results
// ---------------------------------------------------------------------------

export type GetBracketResult =
  | { success: true; bracket: BracketView }
  | { success: false; error: 'NOT_APPROVED_MEMBER' | 'FETCH_FAILED' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

/**
 * Minimal read surface this module needs from CompetitionsRepository.
 * Kept narrow and named generically (not "ICompetitionsRepository") so the
 * tournaments module depends only on the slice of behaviour it actually uses.
 */
export interface IMatchesReader {
  findAllMatches(): Promise<Match[]>
}

/**
 * Minimal read surface this module needs from ExpectedResultsService.
 * Method names mirror IExpectedResultsService exactly (not
 * IExpectedResultsRepository) so the real ExpectedResultsService instance
 * satisfies this port structurally with zero adapter code — matching the
 * hexagonal rule that this module's services depend on other services, not
 * directly on repositories.
 *
 * The app has two global prediction modes (see appSettings.types.ts
 * PredictionMode): 'shared' (one prediction per match, shared across every
 * quiniela the member belongs to — quiniela_id IS NULL in the DB) and
 * 'per_quiniela' (a distinct prediction per quiniela). Both read methods are
 * exposed here so TournamentBracketService can branch on the active mode
 * exactly like app/[lang]/(private)/welcome/page.tsx does: per_quiniela mode
 * reads findByUserIdAndQuiniela(userId, quinielaId); shared mode reads
 * getExpectedResultsForUser(userId) (NOT findByUserIdAndQuiniela(userId, null)
 * scoped to one quiniela — shared predictions apply to every quiniela
 * uniformly, exactly as welcome/page.tsx reads them).
 */
export interface IPredictionsReader {
  findByUserIdAndQuiniela(userId: string, quinielaId: string | null): Promise<
    { matchId: string; homeScore: number; awayScore: number }[]
  >
  /** All of a user's predictions regardless of quiniela — used in 'shared' prediction mode. */
  getExpectedResultsForUser(userId: string): Promise<
    { matchId: string; homeScore: number; awayScore: number }[]
  >
}

/**
 * Minimal read surface this module needs from AppSettingsService, to learn
 * the active global PredictionMode ('shared' vs 'per_quiniela') before
 * deciding how to read a member's predictions.
 */
export interface IPredictionModeReader {
  getSettings(): Promise<
    | { success: true; settings: { predictionMode: 'shared' | 'per_quiniela' } }
    | { success: false; error: string }
  >
}

export interface IGroupProjectionService {
  /**
   * Compute group-stage standings and qualification projections for every
   * group found in `matches`. Pure function over the match list — no I/O.
   */
  projectGroups(matches: Match[]): GroupProjection[]
}

export interface IBracketCascadeService {
  /**
   * Resolve knockout-stage placeholder matchup descriptions into real team
   * names wherever the group projections make a team's qualification or
   * elimination mathematically certain, or wherever an earlier knockout
   * match has a confirmed result. Pure function over matches + projections
   * — no I/O, no writes back to `matches`.
   */
  resolveCascade(matches: Match[], projections: GroupProjection[]): Map<string, { homeTeamName: string; awayTeamName: string }>
}

export interface ITournamentBracketService {
  /**
   * Build the full bracket view for a member of a quiniela: all knockout
   * matches (R32→Final), each annotated with the member's own prediction
   * (if any) and the confirmed result (if synced), with placeholder
   * matchup descriptions cascade-resolved into real team names wherever
   * mathematically certain.
   *
   * Returns NOT_APPROVED_MEMBER when the caller is not an approved member
   * of the quiniela (access-denied — no bracket data is computed or leaked).
   */
  getBracketForMember(quinielaId: string, userId: string): Promise<GetBracketResult>
}
