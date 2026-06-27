/**
 * Unit tests for TournamentBracketCache — the two-layer cache wrapper over
 * the existing TtlCache utility.
 *
 * Layer 1 is global/shared (quiniela-agnostic); Layer 2 is keyed per
 * (quinielaId, userId). The most important property under test is that
 * Layer 2 NEVER leaks data across tenants (different quinielas) or across
 * users (different members of the same quiniela) sharing the same Layer 1
 * cache — this is the explicit cross-tenant regression test required by
 * the brief.
 */

import {
  TournamentBracketCache,
  resetTournamentBracketCache,
  tournamentBracketCache,
} from '../TournamentBracketCache'
import type { BracketView, GroupProjection } from '../tournaments.types'

afterEach(() => {
  resetTournamentBracketCache()
})

function makeBracketView(quinielaId: string): BracketView {
  return { quinielaId, stages: [] }
}

const EMPTY_PROJECTIONS: GroupProjection[] = []

describe('TournamentBracketCache – Layer 1 (shared, quiniela-agnostic)', () => {
  it('returns undefined when nothing has been cached yet', () => {
    const cache = new TournamentBracketCache()
    expect(cache.getLayer1()).toBeUndefined()
  })

  it('returns the stored skeleton after setLayer1', () => {
    const cache = new TournamentBracketCache()
    const skeleton = { projections: EMPTY_PROJECTIONS, resolvedTeamsByMatchId: new Map() }

    cache.setLayer1(skeleton)

    expect(cache.getLayer1()).toBe(skeleton)
  })

  it('is shared across every quiniela — there is only one Layer 1 entry', () => {
    const cache = new TournamentBracketCache()
    const skeleton = { projections: EMPTY_PROJECTIONS, resolvedTeamsByMatchId: new Map() }
    cache.setLayer1(skeleton)

    // No quinielaId/userId parameter exists on getLayer1 — this is by design,
    // proving a single global cache key regardless of caller.
    expect(cache.getLayer1()).toBe(skeleton)
  })

  it('invalidateLayer1 clears the cached skeleton', () => {
    const cache = new TournamentBracketCache()
    cache.setLayer1({ projections: EMPTY_PROJECTIONS, resolvedTeamsByMatchId: new Map() })

    cache.invalidateLayer1()

    expect(cache.getLayer1()).toBeUndefined()
  })
})

describe('TournamentBracketCache – Layer 2 (per quiniela+user)', () => {
  it('returns undefined for a key that was never set', () => {
    const cache = new TournamentBracketCache()
    expect(cache.getLayer2('quiniela-a', 'user-1')).toBeUndefined()
  })

  it('returns the stored view for the exact (quinielaId, userId) pair', () => {
    const cache = new TournamentBracketCache()
    const view = makeBracketView('quiniela-a')

    cache.setLayer2('quiniela-a', 'user-1', view)

    expect(cache.getLayer2('quiniela-a', 'user-1')).toEqual(view)
  })

  it('REGRESSION: does not leak data between two different quinielas for the same user', () => {
    const cache = new TournamentBracketCache()
    const viewA = makeBracketView('quiniela-a')
    const viewB = makeBracketView('quiniela-b')

    cache.setLayer2('quiniela-a', 'user-1', viewA)
    cache.setLayer2('quiniela-b', 'user-1', viewB)

    expect(cache.getLayer2('quiniela-a', 'user-1')).toEqual(viewA)
    expect(cache.getLayer2('quiniela-b', 'user-1')).toEqual(viewB)
  })

  it('REGRESSION: does not leak data between two different users in the same quiniela', () => {
    const cache = new TournamentBracketCache()
    const viewForUser1: BracketView = {
      quinielaId: 'quiniela-a',
      stages: [
        {
          stage: 'ROUND_OF_32',
          matchups: [
            {
              matchId: 'match-1',
              bracketSlot: 'R32_01',
              stage: 'ROUND_OF_32',
              matchupDescription: 'A vs B',
              homeTeamName: 'A',
              awayTeamName: 'B',
              teamsResolved: true,
              status: 'SCHEDULED',
              scheduledAt: '2026-06-28T20:00:00Z',
              prediction: { homeScore: 2, awayScore: 1 },
              result: null,
            },
          ],
        },
      ],
    }
    const viewForUser2: BracketView = {
      ...viewForUser1,
      stages: [
        {
          ...viewForUser1.stages[0],
          matchups: [{ ...viewForUser1.stages[0].matchups[0], prediction: null }],
        },
      ],
    }

    cache.setLayer2('quiniela-a', 'user-1', viewForUser1)
    cache.setLayer2('quiniela-a', 'user-2', viewForUser2)

    expect(cache.getLayer2('quiniela-a', 'user-1')?.stages[0].matchups[0].prediction).toEqual({
      homeScore: 2,
      awayScore: 1,
    })
    expect(cache.getLayer2('quiniela-a', 'user-2')?.stages[0].matchups[0].prediction).toBeNull()
  })

  it('invalidateLayer2 removes only the targeted key, leaving others intact', () => {
    const cache = new TournamentBracketCache()
    cache.setLayer2('quiniela-a', 'user-1', makeBracketView('quiniela-a'))
    cache.setLayer2('quiniela-a', 'user-2', makeBracketView('quiniela-a'))

    cache.invalidateLayer2('quiniela-a', 'user-1')

    expect(cache.getLayer2('quiniela-a', 'user-1')).toBeUndefined()
    expect(cache.getLayer2('quiniela-a', 'user-2')).toBeDefined()
  })

  it('clearLayer2 removes every Layer 2 entry across all quinielas and users', () => {
    const cache = new TournamentBracketCache()
    cache.setLayer2('quiniela-a', 'user-1', makeBracketView('quiniela-a'))
    cache.setLayer2('quiniela-b', 'user-2', makeBracketView('quiniela-b'))

    cache.clearLayer2()

    expect(cache.getLayer2('quiniela-a', 'user-1')).toBeUndefined()
    expect(cache.getLayer2('quiniela-b', 'user-2')).toBeUndefined()
  })
})

describe('TournamentBracketCache – module-level singleton', () => {
  it('exports a shared singleton instance used across the module', () => {
    expect(tournamentBracketCache).toBeInstanceOf(TournamentBracketCache)
  })

  it('resetTournamentBracketCache clears both layers on the singleton', () => {
    tournamentBracketCache.setLayer1({ projections: EMPTY_PROJECTIONS, resolvedTeamsByMatchId: new Map() })
    tournamentBracketCache.setLayer2('quiniela-a', 'user-1', makeBracketView('quiniela-a'))

    resetTournamentBracketCache()

    expect(tournamentBracketCache.getLayer1()).toBeUndefined()
    expect(tournamentBracketCache.getLayer2('quiniela-a', 'user-1')).toBeUndefined()
  })
})
