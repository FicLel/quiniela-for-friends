/**
 * BracketCascadeService — display-only resolution of placeholder matchup
 * descriptions into real team names.
 *
 * Pure domain logic, no I/O, no writes back to `matches`. The external
 * football-data.org sync (via CompetitionsService.syncKnockoutMatches) is
 * the sole source of truth for confirmed team names; this service only
 * *derives a display label* ahead of that sync landing, the moment the
 * group projection (or an earlier knockout result) makes it mathematically
 * certain.
 *
 * Two kinds of placeholders are resolved, matching the two shapes seeded in
 * CompetitionsService's KNOCKOUT_PLACEHOLDER_DATA:
 *
 * 1. Round of 32 group-based placeholders, e.g.:
 *      "Group A Winner vs Group B Runner-up"
 *      "Group C Runner-up vs Group F Runner-up"   (third-place qualifier slot)
 *    Resolved from GroupProjection — as soon as a single team's QUALIFIED
 *    status names an exact slot (WINNER / RUNNER_UP) we substitute the real
 *    team name for that side, independently of whether the other side (or
 *    the rest of the group) has finished playing.
 *
 * 2. Later-round bracket placeholders, e.g.:
 *      "Winner R32_01 vs Winner R32_02"
 *      "Loser SF_01 vs Loser SF_02"
 *    Resolved ONLY from real confirmed match results (regulationHomeGoals /
 *    regulationAwayGoals on the referenced bracket_slot), never from
 *    projections — per the brief, later rounds must not be guessed.
 *
 * IMPORTANT: the parsing here depends on the exact wording seeded in
 * CompetitionsService.KNOCKOUT_PLACEHOLDER_DATA. A test in this module's
 * __tests__ folder pins the expected string format so a future seed-data
 * wording change is caught rather than silently breaking cascade resolution.
 */

import type { Match } from '@/competitions/competitions.types'
import type {
  GroupProjection,
  IBracketCascadeService,
} from '@/tournaments/tournaments.types'

type ResolvedTeams = { homeTeamName: string; awayTeamName: string }

/** Matches "Group X Winner" / "Group X Runner-up" (case-sensitive, as seeded). */
const GROUP_SLOT_PATTERN = /^Group ([A-L]) (Winner|Runner-up)$/
/** Matches "Winner R32_01" / "Loser SF_01" referencing another bracket_slot. */
const BRACKET_REF_PATTERN = /^(Winner|Loser) ([A-Z0-9_]+)$/

export class BracketCascadeService implements IBracketCascadeService {
  /**
   * Resolve as many placeholder matchups as are mathematically certain.
   * Returns a Map keyed by matchId -> resolved team names. Matches that
   * cannot yet be resolved (or that already have real team names from the
   * external sync) are simply absent from the returned map.
   */
  resolveCascade(
    matches: Match[],
    projections: GroupProjection[],
  ): Map<string, ResolvedTeams> {
    const resolved = new Map<string, ResolvedTeams>()

    const projectionByGroup = new Map(projections.map((p) => [p.group, p]))
    const matchByBracketSlot = new Map(
      matches.filter((m) => m.bracketSlot !== null).map((m) => [m.bracketSlot as string, m]),
    )

    for (const match of matches) {
      if (!match.matchupDescription) continue
      if (match.homeTeamName !== 'TBD' && match.awayTeamName !== 'TBD') continue

      const sides = match.matchupDescription.split(' vs ')
      if (sides.length !== 2) continue

      const homeLabel = sides[0].trim()
      const awayLabel = sides[1].trim()

      const homeResolved =
        match.homeTeamName !== 'TBD'
          ? match.homeTeamName
          : this.resolveSide(homeLabel, projectionByGroup, matchByBracketSlot)

      const awayResolved =
        match.awayTeamName !== 'TBD'
          ? match.awayTeamName
          : this.resolveSide(awayLabel, projectionByGroup, matchByBracketSlot)

      if (homeResolved !== null || awayResolved !== null) {
        resolved.set(match.id, {
          homeTeamName: homeResolved ?? match.homeTeamName,
          awayTeamName: awayResolved ?? match.awayTeamName,
        })
      }
    }

    return resolved
  }

  /**
   * Resolve a single side label ("Group A Winner" or "Winner R32_01") into
   * a real team name, or null if not yet mathematically certain.
   */
  private resolveSide(
    label: string,
    projectionByGroup: Map<string, GroupProjection>,
    matchByBracketSlot: Map<string, Match>,
  ): string | null {
    const groupMatch = label.match(GROUP_SLOT_PATTERN)
    if (groupMatch) {
      const [, groupLetter, slotWord] = groupMatch
      const group = `GROUP_${groupLetter}`
      const projection = projectionByGroup.get(group)
      if (!projection) return null

      const targetSlot = slotWord === 'Winner' ? 'WINNER' : 'RUNNER_UP'
      const team = projection.standings.find(
        (s) => s.status === 'QUALIFIED' && s.projectedSlot === targetSlot,
      )
      return team ? team.teamName : null
    }

    const bracketMatch = label.match(BRACKET_REF_PATTERN)
    if (bracketMatch) {
      const [, role, referencedSlot] = bracketMatch
      const referencedMatch = matchByBracketSlot.get(referencedSlot)
      if (!referencedMatch) return null
      if (
        referencedMatch.regulationHomeGoals === null ||
        referencedMatch.regulationAwayGoals === null
      ) {
        // Never guess a later-round outcome from a projection — only a
        // confirmed result resolves "Winner R32_01" / "Loser SF_01".
        return null
      }

      const homeWon = referencedMatch.regulationHomeGoals > referencedMatch.regulationAwayGoals
      const awayWon = referencedMatch.regulationAwayGoals > referencedMatch.regulationHomeGoals
      // A draw with no extra-time/penalty data recorded is treated as
      // unresolved (knockout matches cannot end in a draw, but if the
      // sync hasn't yet recorded the decisive result we stay conservative).
      if (!homeWon && !awayWon) return null

      if (role === 'Winner') {
        return homeWon ? referencedMatch.homeTeamName : referencedMatch.awayTeamName
      }
      // role === 'Loser'
      return homeWon ? referencedMatch.awayTeamName : referencedMatch.homeTeamName
    }

    return null
  }
}
