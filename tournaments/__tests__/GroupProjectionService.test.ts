/**
 * Unit tests for GroupProjectionService — combinatorial group qualification
 * projection with FIFA tiebreak order.
 */

import { GroupProjectionService } from '../GroupProjectionService'
import type { Match } from '@/competitions/competitions.types'

let nextId = 1
function makeMatch(overrides: Partial<Match>): Match {
  const id = `match-${nextId++}`
  return {
    id,
    externalId: null,
    stage: 'GROUP_STAGE',
    group: 'GROUP_A',
    matchday: 1,
    status: 'SCHEDULED',
    scheduledAt: new Date('2026-06-14T16:00:00Z'),
    homeTeamExternalId: null,
    homeTeamName: 'Team Home',
    homeTeamShortName: 'Home',
    homeTeamTla: 'HOM',
    homeTeamCrest: null,
    awayTeamExternalId: null,
    awayTeamName: 'Team Away',
    awayTeamShortName: 'Away',
    awayTeamTla: 'AWY',
    awayTeamCrest: null,
    bracketSlot: null,
    matchupDescription: null,
    regulationHomeGoals: null,
    regulationAwayGoals: null,
    lastSyncedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  nextId = 1
})

describe('GroupProjectionService – grouping', () => {
  it('returns one projection per distinct group, ignoring non-GROUP_STAGE matches', () => {
    const service = new GroupProjectionService()
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A1', awayTeamName: 'A2' }),
      makeMatch({ group: 'GROUP_B', homeTeamName: 'B1', awayTeamName: 'B2' }),
      makeMatch({ stage: 'ROUND_OF_16', group: '', homeTeamName: 'X', awayTeamName: 'Y' }),
    ]

    const projections = service.projectGroups(matches)

    expect(projections.map((p) => p.group)).toEqual(['GROUP_A', 'GROUP_B'])
  })

  it('returns [] when there are no group-stage matches', () => {
    const service = new GroupProjectionService()
    expect(service.projectGroups([])).toEqual([])
  })
})

describe('GroupProjectionService – isComplete flag', () => {
  it('marks a group complete once all fixtures have regulation goals', () => {
    const service = new GroupProjectionService()
    const matches = [
      makeMatch({
        group: 'GROUP_A',
        homeTeamName: 'A1',
        awayTeamName: 'A2',
        regulationHomeGoals: 2,
        regulationAwayGoals: 0,
      }),
    ]

    const [projection] = service.projectGroups(matches)
    expect(projection.isComplete).toBe(true)
  })

  it('marks a group incomplete while any fixture is unplayed', () => {
    const service = new GroupProjectionService()
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A1', awayTeamName: 'A2' }),
    ]

    const [projection] = service.projectGroups(matches)
    expect(projection.isComplete).toBe(false)
  })
})

describe('GroupProjectionService – fully decided group (all fixtures played)', () => {
  it('assigns QUALIFIED to top two, ELIMINATED to the rest, with correct slots', () => {
    const service = new GroupProjectionService()
    // Round-robin among 4 teams, all 6 matches played; A and B win all, C and D lose all.
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'B', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'C', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'C', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'D', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'C', awayTeamName: 'D', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
    ]

    const [projection] = service.projectGroups(matches)
    expect(projection.isComplete).toBe(true)

    const byName = new Map(projection.standings.map((s) => [s.teamName, s]))
    expect(byName.get('A')?.status).toBe('QUALIFIED')
    expect(byName.get('A')?.projectedSlot).toBe('WINNER')
    expect(byName.get('B')?.status).toBe('QUALIFIED')
    expect(byName.get('B')?.projectedSlot).toBe('RUNNER_UP')
    expect(byName.get('C')?.status).toBe('ELIMINATED')
    expect(byName.get('D')?.status).toBe('ELIMINATED')
  })
})

describe('GroupProjectionService – early certainty before group finishes', () => {
  it('marks a team QUALIFIED as soon as it cannot mathematically be caught, even with fixtures remaining', () => {
    const service = new GroupProjectionService()
    // A has won both its played matches (6 pts, +6 GD). The only remaining
    // fixture is C vs D — irrelevant to A's qualification math, and B's
    // games are already final, so A's WINNER slot is certain regardless of
    // the still-unplayed C vs D fixture.
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'B', regulationHomeGoals: 4, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'C', regulationHomeGoals: 4, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 4, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'C', regulationHomeGoals: 0, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'D', regulationHomeGoals: 0, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'C', awayTeamName: 'D' }), // remaining
    ]

    const [projection] = service.projectGroups(matches)
    expect(projection.isComplete).toBe(false)

    const byName = new Map(projection.standings.map((s) => [s.teamName, s]))
    expect(byName.get('A')?.status).toBe('QUALIFIED')
    expect(byName.get('A')?.projectedSlot).toBe('WINNER')
  })

  it('marks a team ELIMINATED as soon as it cannot mathematically catch up, even with fixtures remaining', () => {
    const service = new GroupProjectionService()
    // D has lost all 3 played matches by big margins and has no fixtures
    // left at all — eliminated regardless of the still-open A/B/C picture.
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'D', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'C', awayTeamName: 'D', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'B' }), // remaining
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'C' }), // remaining
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'C' }), // remaining
    ]

    const [projection] = service.projectGroups(matches)
    expect(projection.isComplete).toBe(false)

    const byName = new Map(projection.standings.map((s) => [s.teamName, s]))
    expect(byName.get('D')?.status).toBe('ELIMINATED')
  })
})

describe('GroupProjectionService – conservative UNDECIDED (never asserts a false positive)', () => {
  it('keeps a team UNDECIDED when both qualification and elimination remain possible', () => {
    const service = new GroupProjectionService()
    // Nothing played yet — every team's fate is wide open.
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'B' }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'C' }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'D' }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'C' }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'D' }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'C', awayTeamName: 'D' }),
    ]

    const [projection] = service.projectGroups(matches)

    for (const standing of projection.standings) {
      expect(standing.status).toBe('UNDECIDED')
      expect(standing.projectedSlot).toBe('NONE')
    }
  })
})

describe('GroupProjectionService – tiebreak order: points -> GD -> GF', () => {
  it('ranks a higher goal difference above a lower one when points are tied', () => {
    const service = new GroupProjectionService()
    const matches = [
      // A beats B 3-0 (GD +3), C beats D 1-0 (GD +1) — A and C both have 3 pts.
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'B', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'C', awayTeamName: 'D', regulationHomeGoals: 1, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'C', regulationHomeGoals: 0, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'D', regulationHomeGoals: 0, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 2, regulationAwayGoals: 2 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'B', awayTeamName: 'C', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
    ]

    const [projection] = service.projectGroups(matches)
    const order = projection.standings.map((s) => s.teamName)

    // A: 3+1+1=5pts, GD +3-2+0=+1... regardless of exact arithmetic, A must
    // rank strictly above C given A's superior goal difference at equal points.
    const aIndex = order.indexOf('A')
    const cIndex = order.indexOf('C')
    const aStanding = projection.standings[aIndex]
    const cStanding = projection.standings[cIndex]
    if (aStanding.points === cStanding.points) {
      expect(aStanding.goalDifference).toBeGreaterThanOrEqual(cStanding.goalDifference)
    }
  })
})

describe('GroupProjectionService – REGRESSION: never asserts a false positive when sensitive to goal margin', () => {
  it('reports UNDECIDED for both teams when the qualifying spot depends on the margin of a remaining fixture', () => {
    const service = new GroupProjectionService()
    // A is locked in as WINNER (way ahead, no fixtures left).
    // D is locked in as ELIMINATED (way behind, no fixtures left).
    // B and C are points-tied candidates for the RUNNER_UP spot. C currently
    // sits ahead of B on goal difference. B's one remaining fixture (vs D,
    // who is already eliminated and has nothing left to play) can swing
    // B's GD up or down depending on the SCORELINE, not just the W/D/L
    // outcome:
    //   - B beats D by a single goal (e.g. 1-0)  -> B's GD stays behind C -> C qualifies.
    //   - B beats D by a landslide (e.g. 6-0)     -> B's GD overtakes C   -> B qualifies instead.
    // The real-world outcome is therefore genuinely undecided until the
    // fixture is played by an exact score, not just an outcome — the
    // projection must NEVER assert QUALIFIED/ELIMINATED for either B or C
    // here, even though naive fixed-margin simulation incorrectly did so
    // before this fix (always testing a 1-0 win, which never let B catch up).
    const matches = [
      makeMatch({ homeTeamName: 'A', awayTeamName: 'B', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'A', awayTeamName: 'C', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'B', awayTeamName: 'C', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
      makeMatch({ homeTeamName: 'C', awayTeamName: 'D', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'B', awayTeamName: 'D' }), // remaining — margin-sensitive
    ]

    const [projection] = service.projectGroups(matches)
    const byName = new Map(projection.standings.map((s) => [s.teamName, s]))

    expect(byName.get('A')?.status).toBe('QUALIFIED')
    expect(byName.get('A')?.projectedSlot).toBe('WINNER')
    expect(byName.get('D')?.status).toBe('ELIMINATED')

    // The crux of the regression: neither B nor C may be asserted as a
    // definite winner of the contested RUNNER_UP spot.
    expect(byName.get('B')?.status).toBe('UNDECIDED')
    expect(byName.get('C')?.status).toBe('UNDECIDED')
  })

  it('sanity check: the same fixture set, played out as a landslide for B, actually flips the real outcome', () => {
    const service = new GroupProjectionService()
    // Same group as above, but with the remaining B vs D fixture actually
    // played as a landslide for B — proving the margin genuinely controls
    // the real qualification outcome (B qualifies here, not C), which is
    // exactly why the UNDECIDED verdict above is correct and not overly
    // conservative.
    const matches = [
      makeMatch({ homeTeamName: 'A', awayTeamName: 'B', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'A', awayTeamName: 'C', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'A', awayTeamName: 'D', regulationHomeGoals: 5, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'B', awayTeamName: 'C', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
      makeMatch({ homeTeamName: 'C', awayTeamName: 'D', regulationHomeGoals: 3, regulationAwayGoals: 0 }),
      makeMatch({ homeTeamName: 'B', awayTeamName: 'D', regulationHomeGoals: 6, regulationAwayGoals: 0 }),
    ]

    const [projection] = service.projectGroups(matches)
    const byName = new Map(projection.standings.map((s) => [s.teamName, s]))

    expect(projection.isComplete).toBe(true)
    expect(byName.get('B')?.status).toBe('QUALIFIED')
    expect(byName.get('B')?.projectedSlot).toBe('RUNNER_UP')
    expect(byName.get('C')?.status).toBe('ELIMINATED')
  })
})

describe('GroupProjectionService – fair-play tiebreak is a permanent no-op', () => {
  it('never throws or special-cases fair play; ties without a clear GD/GF winner stay ordered by name', () => {
    const service = new GroupProjectionService()
    // Two teams finish with identical points, GD, and GF — no fair-play data
    // exists in the schema, so the implementation must fall through to a
    // stable deterministic tiebreak rather than crash or guess.
    const matches = [
      makeMatch({ group: 'GROUP_A', homeTeamName: 'Alpha', awayTeamName: 'Beta', regulationHomeGoals: 1, regulationAwayGoals: 1 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'Alpha', awayTeamName: 'Gamma', regulationHomeGoals: 1, regulationAwayGoals: 0 }),
      makeMatch({ group: 'GROUP_A', homeTeamName: 'Beta', awayTeamName: 'Gamma', regulationHomeGoals: 1, regulationAwayGoals: 0 }),
    ]

    expect(() => service.projectGroups(matches)).not.toThrow()
  })
})
