/**
 * Tests for the syncMatchResult server action.
 *
 * These are unit tests that mock the auth layer and the competitions/scoring
 * service constructors to verify the action's auth checks, validation, and
 * delegation logic.
 */

// Mock AuthClient — overridden per-test via mockVerifyToken's resolved value
const mockVerifyToken = jest.fn()
const mockRequireWritableSession = jest.fn().mockReturnValue({ allowed: true })
jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    getTokenFromServerAction: jest.fn().mockResolvedValue('mock-token'),
    verifyToken: mockVerifyToken,
    requireWritableSession: mockRequireWritableSession,
  })),
}))

// Mock CompetitionsService — capture constructor args and stub syncRegulationResults
const mockSyncRegulationResults = jest.fn()
const mockCompetitionsServiceCtor = jest.fn()
jest.mock('@/competitions/CompetitionsService', () => ({
  CompetitionsService: jest.fn().mockImplementation((...args: unknown[]) => {
    mockCompetitionsServiceCtor(...args)
    return { syncRegulationResults: mockSyncRegulationResults }
  }),
}))

jest.mock('@/competitions/CompetitionsRepository', () => ({
  CompetitionsRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/competitions/CompetitionsClient', () => ({
  CompetitionsClient: jest.fn().mockImplementation(() => ({})),
}))

const mockGetCrowdPercentagesForMatches = jest.fn()
jest.mock('@/scoring/ScoringService', () => ({
  ScoringService: jest.fn().mockImplementation(() => ({
    getCrowdPercentagesForMatches: mockGetCrowdPercentagesForMatches,
  })),
}))

jest.mock('@/scoring/PredictionScoreRepository', () => ({
  PredictionScoreRepository: jest.fn().mockImplementation(() => ({})),
}))

// Other actions in this module pull in repositories/services we don't need here
jest.mock('@/expectedResults/ExpectedResultsRepository', () => ({
  ExpectedResultsRepository: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@/expectedResults/ExpectedResultsService', () => ({
  ExpectedResultsService: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@/memberships/MembershipsRepository', () => ({
  MembershipsRepository: jest.fn().mockImplementation(() => ({})),
}))

import { syncMatchResult, fetchCrowdPercentages } from '../actions'

describe('fetchCrowdPercentages action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns {} when matchIds is an empty array', async () => {
    const result = await fetchCrowdPercentages([])

    expect(result).toEqual({})
    expect(mockGetCrowdPercentagesForMatches).not.toHaveBeenCalled()
  })

  it('returns {} when matchIds is not an array', async () => {
    // Cast to bypass TypeScript — simulates a bad call from the client
    const result = await fetchCrowdPercentages(null as unknown as string[])

    expect(result).toEqual({})
    expect(mockGetCrowdPercentagesForMatches).not.toHaveBeenCalled()
  })

  it('delegates to ScoringService.getCrowdPercentagesForMatches with the given ids', async () => {
    mockGetCrowdPercentagesForMatches.mockResolvedValue(
      new Map([
        ['match-1', { homeWinPct: 60, drawPct: 20, awayWinPct: 20 }],
        ['match-2', { homeWinPct: 0, drawPct: 0, awayWinPct: 0 }],
      ]),
    )

    const result = await fetchCrowdPercentages(['match-1', 'match-2'])

    expect(mockGetCrowdPercentagesForMatches).toHaveBeenCalledWith(['match-1', 'match-2'])
    expect(result['match-1']).toEqual({ homeWinPct: 60, drawPct: 20, awayWinPct: 20 })
  })

  it('normalises all-zero entries to null (no predictions submitted)', async () => {
    mockGetCrowdPercentagesForMatches.mockResolvedValue(
      new Map([
        ['match-1', { homeWinPct: 0, drawPct: 0, awayWinPct: 0 }],
        ['match-2', { homeWinPct: 50, drawPct: 30, awayWinPct: 20 }],
      ]),
    )

    const result = await fetchCrowdPercentages(['match-1', 'match-2'])

    expect(result['match-1']).toBeNull()
    expect(result['match-2']).toEqual({ homeWinPct: 50, drawPct: 30, awayWinPct: 20 })
  })

  it('returns a plain Record (JSON-serialisable), not a Map', async () => {
    mockGetCrowdPercentagesForMatches.mockResolvedValue(
      new Map([['match-1', { homeWinPct: 40, drawPct: 30, awayWinPct: 30 }]]),
    )

    const result = await fetchCrowdPercentages(['match-1'])

    // A plain object supports JSON.stringify without losing data
    expect(typeof result).toBe('object')
    expect(result).not.toBeInstanceOf(Map)
    expect(Object.keys(result)).toContain('match-1')
  })
})

describe('syncMatchResult action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireWritableSession.mockReturnValue({ allowed: true })
  })

  it('returns UNAUTHORIZED when there is no session', async () => {
    mockVerifyToken.mockResolvedValue(null)

    const result = await syncMatchResult('match-1', 2, 1)

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockSyncRegulationResults).not.toHaveBeenCalled()
  })

  it('returns UNAUTHORIZED when the session role is not admin', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user-1', role: 'player' })

    const result = await syncMatchResult('match-1', 2, 1)

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockSyncRegulationResults).not.toHaveBeenCalled()
  })

  describe('as an admin', () => {
    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ sub: 'admin-1', role: 'admin' })
    })

    it('returns IMPERSONATING_READ_ONLY when the admin session is impersonating', async () => {
      mockRequireWritableSession.mockReturnValue({ allowed: false, error: 'IMPERSONATING_READ_ONLY' })

      const result = await syncMatchResult('match-1', 2, 1)

      expect(result).toEqual({ success: false, error: 'IMPERSONATING_READ_ONLY' })
      expect(mockSyncRegulationResults).not.toHaveBeenCalled()
    })

    it('returns INVALID_PAYLOAD for negative goals', async () => {
      const result = await syncMatchResult('match-1', -1, 1)

      expect(result).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
      expect(mockSyncRegulationResults).not.toHaveBeenCalled()
    })

    it('returns INVALID_PAYLOAD for non-integer goals', async () => {
      const result = await syncMatchResult('match-1', 1.5, 1)

      expect(result).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
      expect(mockSyncRegulationResults).not.toHaveBeenCalled()
    })

    it('delegates to CompetitionsService.syncRegulationResults with a single-match payload', async () => {
      mockSyncRegulationResults.mockResolvedValue({ success: true, matchesUpdated: 1, scoresUpdated: 4 })

      const result = await syncMatchResult('match-1', 2, 1)

      expect(mockSyncRegulationResults).toHaveBeenCalledWith([
        { matchId: 'match-1', regulationHomeGoals: 2, regulationAwayGoals: 1 },
      ])
      expect(result).toEqual({ success: true, matchesUpdated: 1, scoresUpdated: 4 })
    })

    it('constructs CompetitionsService with a scoring service so points are recalculated', async () => {
      mockSyncRegulationResults.mockResolvedValue({ success: true, matchesUpdated: 1, scoresUpdated: 0 })

      await syncMatchResult('match-1', 0, 0)

      expect(mockCompetitionsServiceCtor).toHaveBeenCalledTimes(1)
      const [, , scoringService] = mockCompetitionsServiceCtor.mock.calls[0]
      expect(scoringService).toBeDefined()
    })

    it('returns DB_ERROR when the service reports a DB error', async () => {
      mockSyncRegulationResults.mockResolvedValue({ success: false, error: 'DB_ERROR' })

      const result = await syncMatchResult('match-1', 2, 1)

      expect(result).toEqual({ success: false, error: 'DB_ERROR' })
    })
  })
})
