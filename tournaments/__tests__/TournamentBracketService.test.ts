/**
 * Unit tests for TournamentBracketService — orchestrates matches + user
 * predictions + group projections + cascade resolution into a BracketView,
 * with access-gating and the two-layer cache.
 */

import { TournamentBracketService } from '../TournamentBracketService'
import { TournamentBracketCache, resetTournamentBracketCache } from '../TournamentBracketCache'
import type { Match } from '@/competitions/competitions.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'
import type {
  GroupProjection,
  IBracketCascadeService,
  IGroupProjectionService,
  IMatchesReader,
  IPredictionModeReader,
  IPredictionsReader,
} from '../tournaments.types'

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

beforeEach(() => {
  nextId = 1
  // TournamentBracketCache wraps module-level TtlCache singletons (matching
  // the existing matchesCache / playerPredictionsCache pattern elsewhere in
  // the codebase) — even a freshly-`new`'d instance reads/writes the same
  // underlying cache, so tests must reset it explicitly between runs.
  resetTournamentBracketCache()
})

function makeMembershipsRepository(
  overrides: Partial<IMembershipsRepository> = {},
): IMembershipsRepository {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByQuinielaAndUser: jest.fn(),
    findAllByQuiniela: jest.fn(),
    deleteById: jest.fn(),
    countAdmins: jest.fn(),
    approve: jest.fn(),
    isMember: jest.fn(),
    isApprovedMember: jest.fn().mockResolvedValue(true),
    countByUser: jest.fn(),
    ...overrides,
  }
}

function makeMatchesReader(matches: Match[] = []): IMatchesReader {
  return { findAllMatches: jest.fn().mockResolvedValue(matches) }
}

/**
 * Defaults to returning the SAME predictions array for both getExpectedResultsForUser
 * (shared mode) and findByUserIdAndQuiniela (per_quiniela mode) so existing
 * tests that don't care about prediction-mode branching keep working
 * unmodified. Tests that specifically exercise mode branching override one
 * or the other explicitly.
 */
function makePredictionsReader(
  predictions: { matchId: string; homeScore: number; awayScore: number }[] = [],
  overrides: Partial<IPredictionsReader> = {},
): IPredictionsReader {
  return {
    findByUserIdAndQuiniela: jest.fn().mockResolvedValue(predictions),
    getExpectedResultsForUser: jest.fn().mockResolvedValue(predictions),
    ...overrides,
  }
}

/** Defaults to 'shared' mode — the app's actual default per appSettings. */
function makePredictionModeReader(
  mode: 'shared' | 'per_quiniela' = 'shared',
): IPredictionModeReader {
  return {
    getSettings: jest.fn().mockResolvedValue({ success: true, settings: { predictionMode: mode } }),
  }
}

function makeGroupProjectionService(projections: GroupProjection[] = []): IGroupProjectionService {
  return { projectGroups: jest.fn().mockReturnValue(projections) }
}

function makeCascadeService(
  resolved: Map<string, { homeTeamName: string; awayTeamName: string }> = new Map(),
): IBracketCascadeService {
  return { resolveCascade: jest.fn().mockReturnValue(resolved) }
}

// ---------------------------------------------------------------------------
// Access gate
// ---------------------------------------------------------------------------

describe('TournamentBracketService – access gate', () => {
  it('returns NOT_APPROVED_MEMBER and computes nothing when the caller is not an approved member', async () => {
    const cache = new TournamentBracketCache()
    const matchesReader = makeMatchesReader([makeMatch({})])
    const membershipsRepository = makeMembershipsRepository({
      isApprovedMember: jest.fn().mockResolvedValue(false),
    })

    const service = new TournamentBracketService(
      matchesReader,
      makePredictionsReader(),
      membershipsRepository,
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result).toEqual({ success: false, error: 'NOT_APPROVED_MEMBER' })
    expect(matchesReader.findAllMatches).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Happy path: bracket assembly
// ---------------------------------------------------------------------------

describe('TournamentBracketService – getBracketForMember happy path', () => {
  it('groups knockout matches by stage in tournament order', async () => {
    const cache = new TournamentBracketCache()
    const matches = [
      makeMatch({ stage: 'FINAL', scheduledAt: new Date('2026-07-19T23:00:00Z'), homeTeamName: 'A', awayTeamName: 'B' }),
      makeMatch({ stage: 'ROUND_OF_32', scheduledAt: new Date('2026-06-28T20:00:00Z'), homeTeamName: 'C', awayTeamName: 'D' }),
      makeMatch({ stage: 'GROUP_STAGE', group: 'GROUP_A', homeTeamName: 'E', awayTeamName: 'F' }),
    ]

    const service = new TournamentBracketService(
      makeMatchesReader(matches),
      makePredictionsReader(),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    const stageNames = result.bracket.stages.map((s) => s.stage)
    expect(stageNames).toEqual(['ROUND_OF_32', 'FINAL'])
    // GROUP_STAGE matches are excluded from the bracket view entirely.
    expect(stageNames).not.toContain('GROUP_STAGE')
  })

  it('attaches the member own prediction to a matchup when one was submitted', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      makePredictionsReader([{ matchId: match.id, homeScore: 2, awayScore: 1 }]),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    const card = result.bracket.stages[0].matchups[0]
    expect(card.prediction).toEqual({ homeScore: 2, awayScore: 1 })
  })

  it('shows an explicit empty prediction state (null) for an unplayed match with no submitted prediction', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      makePredictionsReader([]),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    const card = result.bracket.stages[0].matchups[0]
    expect(card.prediction).toBeNull()
    expect(card.result).toBeNull()
  })

  it('shows both the prediction and the confirmed result once the match has synced regulation goals', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({
      homeTeamName: 'A',
      awayTeamName: 'B',
      status: 'FINISHED',
      regulationHomeGoals: 2,
      regulationAwayGoals: 0,
    })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      makePredictionsReader([{ matchId: match.id, homeScore: 1, awayScore: 1 }]),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    const card = result.bracket.stages[0].matchups[0]
    expect(card.prediction).toEqual({ homeScore: 1, awayScore: 1 })
    expect(card.result).toEqual({ homeGoals: 2, awayGoals: 0 })
  })

  it('applies cascade-resolved team names onto the matchup card', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({
      matchupDescription: 'Group A Winner vs Group B Runner-up',
      homeTeamName: 'TBD',
      awayTeamName: 'TBD',
    })
    const resolved = new Map([[match.id, { homeTeamName: 'Spain', awayTeamName: 'TBD' }]])

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      makePredictionsReader(),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(resolved),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    const card = result.bracket.stages[0].matchups[0]
    expect(card.homeTeamName).toBe('Spain')
    expect(card.awayTeamName).toBe('TBD')
    expect(card.teamsResolved).toBe(false)
  })

  it('reports the third-place match under its own distinct stage, not as an error', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({ stage: 'THIRD_PLACE', homeTeamName: 'A', awayTeamName: 'B' })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      makePredictionsReader(),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.bracket.stages.map((s) => s.stage)).toEqual(['THIRD_PLACE'])
  })
})

// ---------------------------------------------------------------------------
// REGRESSION: prediction-mode branching (shared vs per_quiniela)
//
// The app's global PredictionMode determines how a member's predictions are
// stored: 'shared' predictions have quiniela_id IS NULL and apply uniformly
// across every quiniela; 'per_quiniela' predictions are scoped to one
// quiniela. Reading predictions via findByUserIdAndQuiniela(userId, quinielaId)
// in shared mode would always return [] (since shared rows are never scoped
// to a real quinielaId), silently hiding every prediction. This must never
// happen — predictions have to be read via the branch matching the active
// mode, exactly like app/[lang]/(private)/welcome/page.tsx does.
// ---------------------------------------------------------------------------

describe('TournamentBracketService – REGRESSION: prediction-mode branching', () => {
  it('reads predictions via getExpectedResultsForUser (not findByUserIdAndQuiniela) when the app is in shared mode', async () => {
    const match = makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })
    const predictionsReader = makePredictionsReader([], {
      getExpectedResultsForUser: jest.fn().mockResolvedValue([{ matchId: match.id, homeScore: 4, awayScore: 2 }]),
      findByUserIdAndQuiniela: jest.fn().mockResolvedValue([]),
    })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      predictionsReader,
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader('shared'),
      new TournamentBracketCache(),
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    // The crux of the regression: the shared-mode prediction is actually
    // surfaced on the bracket card, proving getExpectedResultsForUser was used instead
    // of findByUserIdAndQuiniela (which the mock above wires to return []).
    expect(result.bracket.stages[0].matchups[0].prediction).toEqual({ homeScore: 4, awayScore: 2 })
    expect(predictionsReader.getExpectedResultsForUser).toHaveBeenCalledWith('user-1')
    expect(predictionsReader.findByUserIdAndQuiniela).not.toHaveBeenCalled()
  })

  it('reads predictions via findByUserIdAndQuiniela (not getExpectedResultsForUser) when the app is in per_quiniela mode', async () => {
    const match = makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })
    const predictionsReader = makePredictionsReader([], {
      getExpectedResultsForUser: jest.fn().mockResolvedValue([]),
      findByUserIdAndQuiniela: jest
        .fn()
        .mockResolvedValue([{ matchId: match.id, homeScore: 1, awayScore: 0 }]),
    })

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      predictionsReader,
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader('per_quiniela'),
      new TournamentBracketCache(),
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.bracket.stages[0].matchups[0].prediction).toEqual({ homeScore: 1, awayScore: 0 })
    expect(predictionsReader.findByUserIdAndQuiniela).toHaveBeenCalledWith('user-1', 'quiniela-a')
    expect(predictionsReader.getExpectedResultsForUser).not.toHaveBeenCalled()
  })

  it('falls back to shared mode (getExpectedResultsForUser) when the settings lookup itself fails', async () => {
    const match = makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })
    const predictionsReader = makePredictionsReader([], {
      getExpectedResultsForUser: jest.fn().mockResolvedValue([{ matchId: match.id, homeScore: 2, awayScore: 2 }]),
      findByUserIdAndQuiniela: jest.fn().mockResolvedValue([]),
    })
    const predictionModeReader: IPredictionModeReader = {
      getSettings: jest.fn().mockResolvedValue({ success: false, error: 'NOT_FOUND' }),
    }

    const service = new TournamentBracketService(
      makeMatchesReader([match]),
      predictionsReader,
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      predictionModeReader,
      new TournamentBracketCache(),
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.bracket.stages[0].matchups[0].prediction).toEqual({ homeScore: 2, awayScore: 2 })
    expect(predictionsReader.getExpectedResultsForUser).toHaveBeenCalled()
    expect(predictionsReader.findByUserIdAndQuiniela).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('TournamentBracketService – error handling', () => {
  it('returns FETCH_FAILED when the matches reader throws', async () => {
    const cache = new TournamentBracketCache()
    const matchesReader: IMatchesReader = {
      findAllMatches: jest.fn().mockRejectedValue(new Error('network down')),
    }

    const service = new TournamentBracketService(
      matchesReader,
      makePredictionsReader(),
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result).toEqual({ success: false, error: 'FETCH_FAILED' })
  })

  it('returns UNKNOWN_ERROR when the memberships check itself throws', async () => {
    const cache = new TournamentBracketCache()
    const membershipsRepository = makeMembershipsRepository({
      isApprovedMember: jest.fn().mockRejectedValue(new Error('db down')),
    })

    const service = new TournamentBracketService(
      makeMatchesReader([]),
      makePredictionsReader(),
      membershipsRepository,
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const result = await service.getBracketForMember('quiniela-a', 'user-1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// Caching behaviour
// ---------------------------------------------------------------------------

describe('TournamentBracketService – Layer 2 cache', () => {
  it('serves a second call from the cache without re-fetching matches or predictions', async () => {
    const cache = new TournamentBracketCache()
    const matchesReader = makeMatchesReader([makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })])
    const predictionsReader = makePredictionsReader([])

    const service = new TournamentBracketService(
      matchesReader,
      predictionsReader,
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    await service.getBracketForMember('quiniela-a', 'user-1')
    await service.getBracketForMember('quiniela-a', 'user-1')

    expect(matchesReader.findAllMatches).toHaveBeenCalledTimes(1)
    // Default mode is 'shared' (see makePredictionModeReader's default), so
    // predictions are read via getExpectedResultsForUser, not findByUserIdAndQuiniela.
    expect(predictionsReader.getExpectedResultsForUser).toHaveBeenCalledTimes(1)
  })

  it('REGRESSION: does not leak bracket data between two different quinielas for the same user', async () => {
    const cache = new TournamentBracketCache()
    const matchA = makeMatch({ homeTeamName: 'Spain', awayTeamName: 'England' })
    const matchB = makeMatch({ homeTeamName: 'France', awayTeamName: 'Germany' })

    const service = new TournamentBracketService(
      { findAllMatches: jest.fn().mockResolvedValue([matchA, matchB]) },
      {
        findByUserIdAndQuiniela: jest
          .fn()
          .mockImplementation(async (_userId: string, quinielaId: string | null) =>
            quinielaId === 'quiniela-a'
              ? [{ matchId: matchA.id, homeScore: 2, awayScore: 0 }]
              : [{ matchId: matchB.id, homeScore: 1, awayScore: 1 }],
          ),
        // This test exercises per_quiniela-mode branching (predictionModeReader
        // below is set to 'per_quiniela'), so getExpectedResultsForUser is never called —
        // still provided to satisfy the IPredictionsReader shape.
        getExpectedResultsForUser: jest.fn().mockResolvedValue([]),
      },
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader('per_quiniela'),
      cache,
    )

    const resultA = await service.getBracketForMember('quiniela-a', 'user-1')
    const resultB = await service.getBracketForMember('quiniela-b', 'user-1')

    expect(resultA.success && resultA.bracket.quinielaId).toBe('quiniela-a')
    expect(resultB.success && resultB.bracket.quinielaId).toBe('quiniela-b')

    if (resultA.success && resultB.success) {
      const cardA = resultA.bracket.stages[0].matchups.find((m) => m.matchId === matchA.id)
      const cardBFromResultA = resultA.bracket.stages[0].matchups.find((m) => m.matchId === matchB.id)
      expect(cardA?.prediction).toEqual({ homeScore: 2, awayScore: 0 })
      // Both matches appear in every quiniela's bracket (the bracket itself
      // is shared/global), but matchB's *prediction* must never bleed into
      // quiniela-a's view, even though both quinielas share the same Layer 1
      // matches/projections — only quiniela-a's own predictions apply here.
      expect(cardBFromResultA?.prediction).toBeNull()

      const cardB = resultB.bracket.stages[0].matchups.find((m) => m.matchId === matchB.id)
      expect(cardB?.prediction).toEqual({ homeScore: 1, awayScore: 1 })
    }
  })

  it('REGRESSION: does not leak bracket data between two different users sharing the same quiniela and Layer 1', async () => {
    const cache = new TournamentBracketCache()
    const match = makeMatch({ homeTeamName: 'Spain', awayTeamName: 'England' })

    const service = new TournamentBracketService(
      { findAllMatches: jest.fn().mockResolvedValue([match]) },
      {
        findByUserIdAndQuiniela: jest.fn().mockResolvedValue([]),
        // Default 'shared' mode (see predictionModeReader below) reads via
        // getExpectedResultsForUser, keyed only on userId — exactly mirroring how a real
        // shared-mode prediction lookup has no quiniela_id filter.
        getExpectedResultsForUser: jest.fn().mockImplementation(async (userId: string) =>
          userId === 'user-1'
            ? [{ matchId: match.id, homeScore: 3, awayScore: 0 }]
            : [],
        ),
      },
      makeMembershipsRepository(),
      makeGroupProjectionService(),
      makeCascadeService(),
      makePredictionModeReader(),
      cache,
    )

    const resultUser1 = await service.getBracketForMember('quiniela-a', 'user-1')
    const resultUser2 = await service.getBracketForMember('quiniela-a', 'user-2')

    expect(resultUser1.success && resultUser1.bracket.stages[0].matchups[0].prediction).toEqual({
      homeScore: 3,
      awayScore: 0,
    })
    expect(resultUser2.success && resultUser2.bracket.stages[0].matchups[0].prediction).toBeNull()
  })

  it('rebuilds Layer 1 only once across multiple members, reusing the cached projections and cascade resolution', async () => {
    const cache = new TournamentBracketCache()
    const groupProjectionService = makeGroupProjectionService([])
    const cascadeService = makeCascadeService(new Map())

    const service = new TournamentBracketService(
      makeMatchesReader([makeMatch({ homeTeamName: 'A', awayTeamName: 'B' })]),
      makePredictionsReader([]),
      makeMembershipsRepository(),
      groupProjectionService,
      cascadeService,
      makePredictionModeReader(),
      cache,
    )

    await service.getBracketForMember('quiniela-a', 'user-1')
    await service.getBracketForMember('quiniela-b', 'user-2')

    expect(groupProjectionService.projectGroups).toHaveBeenCalledTimes(1)
    expect(cascadeService.resolveCascade).toHaveBeenCalledTimes(1)
  })
})
