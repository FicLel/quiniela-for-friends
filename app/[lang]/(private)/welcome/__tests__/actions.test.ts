/**
 * Tests for the syncMatchResult server action.
 *
 * These are unit tests that mock the auth layer and the competitions/scoring
 * service constructors to verify the action's auth checks, validation, and
 * delegation logic.
 */

// Mock AuthClient — overridden per-test via mockVerifyToken's resolved value
const mockVerifyToken = jest.fn()
jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    getTokenFromServerAction: jest.fn().mockResolvedValue('mock-token'),
    verifyToken: mockVerifyToken,
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

jest.mock('@/scoring/ScoringService', () => ({
  ScoringService: jest.fn().mockImplementation(() => ({})),
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

import { syncMatchResult } from '../actions'

describe('syncMatchResult action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
