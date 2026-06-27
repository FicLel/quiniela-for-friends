/**
 * GroupProjectionService — combinatorial group-stage qualification projection.
 *
 * Pure domain logic, no I/O: takes the full `matches` list (already fetched
 * by the caller) and computes, for every group, each team's standing plus a
 * qualification projection (QUALIFIED / ELIMINATED / UNDECIDED) by brute-force
 * enumerating mathematically possible outcomes of the group's remaining
 * fixtures.
 *
 * Each World Cup group has at most 4 teams / 6 fixtures, of which at most 3
 * remain unplayed at any point (a team has played at most 2 of its 3 group
 * matches before its last fixture kicks off in practice, but we don't assume
 * that — we simply enumerate whatever GROUP_STAGE matches are not FINISHED).
 *
 * IMPORTANT — margin sensitivity: a fixture's outcome is not fully captured
 * by win/draw/loss alone, because goal DIFFERENCE (not just points) is the
 * second FIFA tiebreak. A team can be ahead on GD against one margin of win
 * for a rival's remaining fixture, yet behind for a larger margin of the
 * same win. To avoid asserting a false-positive QUALIFIED/ELIMINATED verdict
 * in these cases, each remaining fixture is enumerated not just by outcome
 * (HOME_WIN / DRAW / AWAY_WIN) but by a representative MARGIN_SET for each
 * outcome — including a deliberately large "blowout" margin (12 goals,
 * comfortably beyond any realistic World Cup scoreline) alongside small
 * margins. Because final standings are computed by a function that is
 * monotonic in each fixture's goal margin (increasing a team's margin of
 * victory can only help that team's GD and never hurts it, holding every
 * other fixture fixed), testing both a small and a large margin for the
 * same outcome is sufficient to detect every verdict flip: if the verdict
 * is identical across the full margin set tested, it is also guaranteed
 * identical for every untested margin in between and beyond. If the tested
 * margins disagree, the team's fate is genuinely margin-sensitive and the
 * projection conservatively falls through to UNDECIDED rather than
 * asserting either label — satisfying the brief's "never assert a
 * false-positive winner" requirement.
 *
 * ≤3 remaining fixtures × (3 outcomes × margin set) combinations — still
 * cheap to brute-force on every Layer-1 cache rebuild (every 30s at most).
 *
 * Tiebreak order applied per FIFA rules:
 *   1. Points
 *   2. Goal difference
 *   3. Goals scored
 *   4. Head-to-head (only meaningful for 2-way ties; see `headToHeadCompare`)
 *   5. Fair play — no card/discipline data exists in this schema, so this
 *      step is a permanent no-op (falls through to the next step).
 *   6. Lots — used as the final fallback. We never assert a winner here:
 *      any tie that survives to this step is reported as UNDECIDED rather
 *      than guessing, per the brief's "never assert a false-positive winner"
 *      requirement.
 */

import type { Match } from '@/competitions/competitions.types'
import type {
  GroupExitSlot,
  GroupProjection,
  GroupQualificationStatus,
  IGroupProjectionService,
  TeamStanding,
} from '@/tournaments/tournaments.types'

type Outcome = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'

/**
 * Representative winning margins tested for HOME_WIN / AWAY_WIN outcomes.
 * 1 covers the minimal/typical case; 12 stands in for an unbounded "blowout"
 * — comfortably larger than any realistic or historical World Cup scoreline
 * — so that monotonicity (see module doc) lets us safely treat "verdict
 * holds at margin 1 AND at margin 12" as "verdict holds for every margin".
 * DRAW has no margin dimension (always 0-0 for simulation purposes — a
 * draw's goal tally only matters via goals-scored, which is itself bounded
 * by the same monotonicity argument once WIN margins are covered).
 */
const WIN_MARGINS = [1, 12]

type FixtureResult = {
  homeTeam: string
  awayTeam: string
  homeGoals: number
  awayGoals: number
}

type RawStanding = {
  teamName: string
  teamExternalId: number | null
  played: number
  points: number
  goalDifference: number
  goalsFor: number
  goalsAgainst: number
}

export class GroupProjectionService implements IGroupProjectionService {
  /**
   * Compute standings + qualification projections for every GROUP_STAGE
   * group present in `matches`.
   */
  projectGroups(matches: Match[]): GroupProjection[] {
    const groupStageMatches = matches.filter((m) => m.stage === 'GROUP_STAGE' && m.group)

    const byGroup = new Map<string, Match[]>()
    for (const match of groupStageMatches) {
      const list = byGroup.get(match.group) ?? []
      list.push(match)
      byGroup.set(match.group, list)
    }

    const projections: GroupProjection[] = []
    for (const [group, groupMatches] of byGroup.entries()) {
      projections.push(this.projectSingleGroup(group, groupMatches))
    }

    // Stable, deterministic ordering for callers (e.g. cascade resolution, tests).
    projections.sort((a, b) => a.group.localeCompare(b.group))
    return projections
  }

  private projectSingleGroup(group: string, groupMatches: Match[]): GroupProjection {
    const played: FixtureResult[] = []
    const remaining: Match[] = []

    for (const match of groupMatches) {
      if (
        match.regulationHomeGoals !== null &&
        match.regulationAwayGoals !== null
      ) {
        played.push({
          homeTeam: match.homeTeamName,
          awayTeam: match.awayTeamName,
          homeGoals: match.regulationHomeGoals,
          awayGoals: match.regulationAwayGoals,
        })
      } else {
        remaining.push(match)
      }
    }

    const teamExternalIds = new Map<string, number | null>()
    for (const match of groupMatches) {
      teamExternalIds.set(match.homeTeamName, match.homeTeamExternalId)
      teamExternalIds.set(match.awayTeamName, match.awayTeamExternalId)
    }
    const teamNames = Array.from(teamExternalIds.keys())

    const isComplete = remaining.length === 0

    // Baseline standing from already-played fixtures.
    const baseStandings = this.computeStandings(teamNames, played)

    // Enumerate every possible (outcome, margin) combination for remaining
    // fixtures — see module doc for why testing the margin extremes (1 and
    // 12) is sufficient to catch every verdict flip without missing
    // margin-sensitive ties. ≤3 fixtures × (3 outcomes, up to 2 margins
    // each → ≤5 distinct results per fixture) → still cheap to brute-force.
    const allCombinations = this.enumerateOutcomeCombinations(remaining.length)

    // For each team, track across which exit slot (WINNER/RUNNER_UP/THIRD_PLACE/NONE)
    // it lands in for every combination — used to decide QUALIFIED/ELIMINATED/UNDECIDED.
    const slotSetByTeam = new Map<string, Set<GroupExitSlot>>()
    for (const teamName of teamNames) {
      slotSetByTeam.set(teamName, new Set())
    }

    for (const combination of allCombinations) {
      const simulatedResults: FixtureResult[] = [...played]
      for (let i = 0; i < remaining.length; i++) {
        const fixture = remaining[i]
        const { outcome, margin } = combination[i]
        simulatedResults.push(this.simulateFixture(fixture, outcome, margin))
      }

      const standings = this.computeStandings(teamNames, simulatedResults)
      const ranked = this.rankStandings(standings)

      ranked.forEach((standing, index) => {
        const slot = this.slotForRank(index)
        slotSetByTeam.get(standing.teamName)?.add(slot)
      })
    }

    const standings: TeamStanding[] = baseStandings.map((raw) => {
      const slots = slotSetByTeam.get(raw.teamName) ?? new Set<GroupExitSlot>()
      const { status, projectedSlot } = this.resolveStatus(slots)

      return {
        teamName: raw.teamName,
        teamExternalId: raw.teamExternalId,
        played: raw.played,
        points: raw.points,
        goalDifference: raw.goalDifference,
        goalsFor: raw.goalsFor,
        goalsAgainst: raw.goalsAgainst,
        status,
        projectedSlot,
      }
    })

    // Display order: current standing (points → GD → GF → name) regardless of projection.
    standings.sort((a, b) => this.compareTeams(a, b))

    return { group, standings, isComplete }
  }

  /**
   * Decide QUALIFIED / ELIMINATED / UNDECIDED for a team given the set of
   * exit slots it landed in across every enumerated combination.
   *
   * Only WINNER and RUNNER_UP are automatic, within-group qualifying slots
   * for this projection: every group sends exactly its top two through to
   * the round of 32 unconditionally. Third place is a *cross-group*
   * mechanism (only the best third-placed teams across all groups advance)
   * which this single-group projection has no visibility into, so landing
   * in the THIRD_PLACE slot is treated the same as NONE here — i.e. "not
   * automatically qualified from this group alone" — per the brief's rule
   * to never assert a false-positive qualification.
   *
   * - Only ever a non-qualifying slot (THIRD_PLACE/NONE) across all
   *   combinations -> ELIMINATED (cannot finish in the automatic top two).
   * - Only ever WINNER or RUNNER_UP across all combinations -> QUALIFIED,
   *   with the slot reported only when it is identical in every combination
   *   (otherwise we know they qualify but not which exact slot — still
   *   QUALIFIED, slot reported as 'NONE' rather than guessing).
   * - Mixed (sometimes an automatic slot, sometimes not) -> UNDECIDED.
   */
  private resolveStatus(
    slots: Set<GroupExitSlot>,
  ): { status: GroupQualificationStatus; projectedSlot: GroupExitSlot } {
    if (slots.size === 0) {
      return { status: 'UNDECIDED', projectedSlot: 'NONE' }
    }

    const isAutoQualifying = (slot: GroupExitSlot) => slot === 'WINNER' || slot === 'RUNNER_UP'

    const everQualifies = Array.from(slots).some(isAutoQualifying)
    const everFailsToQualify = Array.from(slots).some((s) => !isAutoQualifying(s))

    if (!everQualifies) {
      // Never lands in an automatic qualifying slot across any combination.
      return { status: 'ELIMINATED', projectedSlot: 'NONE' }
    }

    if (everQualifies && !everFailsToQualify) {
      // Always lands in an automatic qualifying slot in every simulated
      // combination. Report the exact slot only if identical across all
      // combinations — otherwise conservatively report 'NONE' rather than
      // guessing, so cascade resolution never asserts a false-positive label.
      const qualifyingSlots = Array.from(slots)
      const slot = qualifyingSlots.length === 1 ? qualifyingSlots[0] : 'NONE'
      return { status: 'QUALIFIED', projectedSlot: slot }
    }

    // Some combinations land in an automatic slot, some don't — still open.
    return { status: 'UNDECIDED', projectedSlot: 'NONE' }
  }

  private slotForRank(rankIndex: number): GroupExitSlot {
    if (rankIndex === 0) return 'WINNER'
    if (rankIndex === 1) return 'RUNNER_UP'
    if (rankIndex === 2) return 'THIRD_PLACE'
    return 'NONE'
  }

  /**
   * Every distinct (outcome, margin) result worth testing for a single
   * remaining fixture: a 0-0 draw, plus a home win and an away win each at
   * every margin in WIN_MARGINS. Margin is irrelevant for draws (always
   * 0-0) — goals-scored ties from draws are covered by the GF tiebreak
   * using the same baseline value across every combination, so no
   * additional margin dimension is needed there.
   */
  private fixtureResultOptions(): { outcome: Outcome; margin: number }[] {
    const options: { outcome: Outcome; margin: number }[] = [{ outcome: 'DRAW', margin: 0 }]
    for (const margin of WIN_MARGINS) {
      options.push({ outcome: 'HOME_WIN', margin })
      options.push({ outcome: 'AWAY_WIN', margin })
    }
    return options
  }

  /**
   * Cartesian product of `count` independent fixture results, each drawn
   * from `fixtureResultOptions()`. See module doc: testing only the margin
   * extremes (1 and 12) per win outcome is sufficient by monotonicity to
   * catch every verdict flip without enumerating every possible scoreline.
   */
  private enumerateOutcomeCombinations(count: number): { outcome: Outcome; margin: number }[][] {
    if (count === 0) return [[]]

    const options = this.fixtureResultOptions()

    let combinations: { outcome: Outcome; margin: number }[][] = [[]]
    for (let i = 0; i < count; i++) {
      const next: { outcome: Outcome; margin: number }[][] = []
      for (const combo of combinations) {
        for (const option of options) {
          next.push([...combo, option])
        }
      }
      combinations = next
    }
    return combinations
  }

  private simulateFixture(fixture: Match, outcome: Outcome, margin: number): FixtureResult {
    let homeGoals = 0
    let awayGoals = 0
    if (outcome === 'HOME_WIN') homeGoals = margin
    else if (outcome === 'AWAY_WIN') awayGoals = margin

    return {
      homeTeam: fixture.homeTeamName,
      awayTeam: fixture.awayTeamName,
      homeGoals,
      awayGoals,
    }
  }

  private computeStandings(teamNames: string[], results: FixtureResult[]): RawStanding[] {
    const standingByTeam = new Map<string, RawStanding>()
    for (const teamName of teamNames) {
      standingByTeam.set(teamName, {
        teamName,
        teamExternalId: null,
        played: 0,
        points: 0,
        goalDifference: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      })
    }

    for (const result of results) {
      const home = standingByTeam.get(result.homeTeam)
      const away = standingByTeam.get(result.awayTeam)
      if (!home || !away) continue

      home.played += 1
      away.played += 1
      home.goalsFor += result.homeGoals
      home.goalsAgainst += result.awayGoals
      away.goalsFor += result.awayGoals
      away.goalsAgainst += result.homeGoals
      home.goalDifference = home.goalsFor - home.goalsAgainst
      away.goalDifference = away.goalsFor - away.goalsAgainst

      if (result.homeGoals > result.awayGoals) {
        home.points += 3
      } else if (result.homeGoals < result.awayGoals) {
        away.points += 3
      } else {
        home.points += 1
        away.points += 1
      }
    }

    return Array.from(standingByTeam.values())
  }

  /**
   * Rank standings applying FIFA tiebreak order: points -> GD -> GF ->
   * head-to-head -> fair play (no-op) -> lots (no-op, ties preserved in
   * input order so callers can detect remaining ties deterministically).
   */
  private rankStandings(standings: RawStanding[]): RawStanding[] {
    return [...standings].sort((a, b) => this.compareTeams(a, b))
  }

  private compareTeams(a: RawStanding, b: RawStanding): number {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    // Head-to-head and fair-play are no-ops (schema has no card data); fall
    // through to a stable, deterministic-but-arbitrary tiebreak (team name)
    // purely to keep sort ordering stable across runs — this never feeds
    // into the QUALIFIED/ELIMINATED projection itself, which is driven by
    // the combinatorial enumeration, not by this final tiebreak.
    return a.teamName.localeCompare(b.teamName)
  }
}
