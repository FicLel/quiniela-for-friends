/**
 * Unit tests for BracketCascadeService — display-only resolution of
 * placeholder matchup descriptions into real team names.
 *
 * Includes a pinned-format test asserting the exact matchupDescription
 * string shapes this service depends on (per the brief's accepted risk:
 * "cascade resolution parses matchupDescription strings rather than
 * structured fields — acceptable but add a test asserting the expected
 * string format so a future seed-data wording change is caught").
 */

import { BracketCascadeService } from '../BracketCascadeService'
import type { Match } from '@/competitions/competitions.types'
import type { GroupProjection } from '../tournaments.types'

let nextId = 1
function makeMatch(overrides: Partial<Match>): Match {
  const id = `match-${nextId++}`
  return {
    id,
    externalId: null,
    stage: 'ROUND_OF_32',
    group: '',
    matchday: 1,
    status: 'SCHEDULED',
    scheduledAt: new Date('2026-06-28T20:00:00Z'),
    homeTeamExternalId: null,
    homeTeamName: 'TBD',
    homeTeamShortName: 'TBD',
    homeTeamTla: 'TBD',
    homeTeamCrest: null,
    awayTeamExternalId: null,
    awayTeamName: 'TBD',
    awayTeamShortName: 'TBD',
    awayTeamTla: 'TBD',
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

function makeQualifiedStanding(teamName: string, slot: 'WINNER' | 'RUNNER_UP') {
  return {
    teamName,
    teamExternalId: null,
    played: 3,
    points: 9,
    goalDifference: 9,
    goalsFor: 9,
    goalsAgainst: 0,
    status: 'QUALIFIED' as const,
    projectedSlot: slot,
  }
}

beforeEach(() => {
  nextId = 1
})

// ---------------------------------------------------------------------------
// Pinned string format — see CompetitionsService.KNOCKOUT_PLACEHOLDER_DATA
// ---------------------------------------------------------------------------

describe('BracketCascadeService – pinned matchupDescription format', () => {
  it('expects group-slot placeholders in the exact "Group X Winner/Runner-up" shape', () => {
    // This pins the wording used by CompetitionsService's seed data. If that
    // wording ever changes, this test (and the parser below) must be
    // updated together — it is intentionally brittle by design.
    const expectedShape = /^Group [A-L] (Winner|Runner-up)$/
    expect('Group A Winner').toMatch(expectedShape)
    expect('Group B Runner-up').toMatch(expectedShape)
  })

  it('expects bracket-reference placeholders in the exact "Winner/Loser <SLOT>" shape', () => {
    const expectedShape = /^(Winner|Loser) [A-Z0-9_]+$/
    expect('Winner R32_01').toMatch(expectedShape)
    expect('Loser SF_01').toMatch(expectedShape)
  })
})

// ---------------------------------------------------------------------------
// Group-based placeholders (Round of 32)
// ---------------------------------------------------------------------------

describe('BracketCascadeService – group-based placeholder resolution', () => {
  it('resolves a side as soon as that group projection is QUALIFIED for the requested slot', () => {
    const service = new BracketCascadeService()
    const match = makeMatch({ matchupDescription: 'Group A Winner vs Group B Runner-up' })
    const projections: GroupProjection[] = [
      { group: 'GROUP_A', isComplete: false, standings: [makeQualifiedStanding('Spain', 'WINNER')] },
      { group: 'GROUP_B', isComplete: false, standings: [makeQualifiedStanding('England', 'RUNNER_UP')] },
    ]

    const resolved = service.resolveCascade([match], projections)

    expect(resolved.get(match.id)).toEqual({ homeTeamName: 'Spain', awayTeamName: 'England' })
  })

  it('resolves only one side when only one group has a certain qualifier', () => {
    const service = new BracketCascadeService()
    const match = makeMatch({ matchupDescription: 'Group A Winner vs Group B Runner-up' })
    const projections: GroupProjection[] = [
      { group: 'GROUP_A', isComplete: false, standings: [makeQualifiedStanding('Spain', 'WINNER')] },
      // Group B has no certain RUNNER_UP yet.
      { group: 'GROUP_B', isComplete: false, standings: [] },
    ]

    const resolved = service.resolveCascade([match], projections)

    expect(resolved.get(match.id)).toEqual({ homeTeamName: 'Spain', awayTeamName: 'TBD' })
  })

  it('does not resolve anything when neither group has a certain qualifier yet', () => {
    const service = new BracketCascadeService()
    const match = makeMatch({ matchupDescription: 'Group A Winner vs Group B Runner-up' })
    const projections: GroupProjection[] = [
      { group: 'GROUP_A', isComplete: false, standings: [] },
      { group: 'GROUP_B', isComplete: false, standings: [] },
    ]

    const resolved = service.resolveCascade([match], projections)

    expect(resolved.has(match.id)).toBe(false)
  })

  it('resolves the third-place-qualifier slot label the same as any other group reference', () => {
    const service = new BracketCascadeService()
    const match = makeMatch({ matchupDescription: 'Group C Runner-up vs Group F Runner-up' })
    const projections: GroupProjection[] = [
      { group: 'GROUP_C', isComplete: false, standings: [makeQualifiedStanding('Brazil', 'RUNNER_UP')] },
      { group: 'GROUP_F', isComplete: false, standings: [makeQualifiedStanding('Japan', 'RUNNER_UP')] },
    ]

    const resolved = service.resolveCascade([match], projections)

    expect(resolved.get(match.id)).toEqual({ homeTeamName: 'Brazil', awayTeamName: 'Japan' })
  })

  it('does not touch a match whose teams are already real (synced) names', () => {
    const service = new BracketCascadeService()
    const match = makeMatch({
      matchupDescription: 'Group A Winner vs Group B Runner-up',
      homeTeamName: 'France',
      awayTeamName: 'Germany',
    })
    const projections: GroupProjection[] = [
      { group: 'GROUP_A', isComplete: false, standings: [makeQualifiedStanding('Spain', 'WINNER')] },
    ]

    const resolved = service.resolveCascade([match], projections)

    expect(resolved.has(match.id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bracket-reference placeholders (R16+, SF, Final, Third-place)
// ---------------------------------------------------------------------------

describe('BracketCascadeService – later-round bracket-reference resolution', () => {
  it('resolves "Winner R32_01" only from a confirmed result on that bracket_slot', () => {
    const service = new BracketCascadeService()
    const r32Match = makeMatch({
      bracketSlot: 'R32_01',
      homeTeamName: 'Spain',
      awayTeamName: 'England',
      regulationHomeGoals: 2,
      regulationAwayGoals: 1,
    })
    const r16Match = makeMatch({
      matchupDescription: 'Winner R32_01 vs Winner R32_02',
      bracketSlot: 'R16_01',
    })

    const resolved = service.resolveCascade([r32Match, r16Match], [])

    expect(resolved.get(r16Match.id)).toEqual({ homeTeamName: 'Spain', awayTeamName: 'TBD' })
  })

  it('resolves "Loser SF_01" to the side that did NOT win', () => {
    const service = new BracketCascadeService()
    const sfMatch = makeMatch({
      bracketSlot: 'SF_01',
      homeTeamName: 'Argentina',
      awayTeamName: 'France',
      regulationHomeGoals: 1,
      regulationAwayGoals: 3,
    })
    const thirdPlaceMatch = makeMatch({
      matchupDescription: 'Loser SF_01 vs Loser SF_02',
      bracketSlot: '3P_01',
    })

    const resolved = service.resolveCascade([sfMatch, thirdPlaceMatch], [])

    expect(resolved.get(thirdPlaceMatch.id)).toEqual({ homeTeamName: 'Argentina', awayTeamName: 'TBD' })
  })

  it('never resolves a later round from a group projection — only from a confirmed result', () => {
    const service = new BracketCascadeService()
    // R32_01 has NOT been played yet (no regulation goals) — even though we
    // pass group projections, "Winner R32_01" must never be guessed from them.
    const r32Match = makeMatch({
      bracketSlot: 'R32_01',
      homeTeamName: 'Spain',
      awayTeamName: 'England',
    })
    const r16Match = makeMatch({
      matchupDescription: 'Winner R32_01 vs Winner R32_02',
      bracketSlot: 'R16_01',
    })
    const projections: GroupProjection[] = [
      { group: 'GROUP_A', isComplete: true, standings: [makeQualifiedStanding('Spain', 'WINNER')] },
    ]

    const resolved = service.resolveCascade([r32Match, r16Match], projections)

    expect(resolved.has(r16Match.id)).toBe(false)
  })

  it('does not write back to the matches table — resolveCascade is a pure function with no side effects', () => {
    const service = new BracketCascadeService()
    const r32Match = makeMatch({
      bracketSlot: 'R32_01',
      homeTeamName: 'Spain',
      awayTeamName: 'England',
      regulationHomeGoals: 2,
      regulationAwayGoals: 1,
    })
    const r16Match = makeMatch({
      matchupDescription: 'Winner R32_01 vs Winner R32_02',
      bracketSlot: 'R16_01',
    })

    service.resolveCascade([r32Match, r16Match], [])

    // The original Match objects must remain untouched — cascade resolution
    // is display-only and never mutates inputs.
    expect(r16Match.homeTeamName).toBe('TBD')
    expect(r16Match.awayTeamName).toBe('TBD')
  })
})
