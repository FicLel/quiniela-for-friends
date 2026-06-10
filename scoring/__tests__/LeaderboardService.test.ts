/**
 * Unit tests for LeaderboardService.
 *
 * IPredictionScoreRepository, IUsersRepository, and IMembershipsRepository
 * are all mocked at the boundary — no real DB queries are made. Tests cover:
 *
 *  - getLeaderboard: 4 new breakdown fields pass through from aggregate to LeaderboardRow
 *  - getLeaderboard: zero-score fallback initializes all 4 new fields to 0
 *  - getPlayerPredictions: delegates to repo.findPlayerPredictionsForViewer and returns result
 *  - getPlayerPredictions: propagates repository error as thrown exception
 */

import { LeaderboardService } from '../LeaderboardService'
import type { IPredictionScoreRepository, PlayerPredictionEntry } from '../scoring.types'
import type { IUsersRepository } from '@/users/users.types'
import type { IMembershipsRepository, MemberWithUser } from '@/memberships/memberships.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAggregateRow(overrides: Partial<{
  userId: string
  totalPoints: number
  exactScoreHits: number
  correctOutcomeHits: number
  predictedMatchCount: number
  homeGoalPoints: number
  awayGoalPoints: number
  outcomePoints: number
  extraQuestionPoints: number
}> = {}) {
  return {
    userId: 'user-uuid-1',
    totalPoints: 6,
    exactScoreHits: 1,
    correctOutcomeHits: 2,
    predictedMatchCount: 3,
    homeGoalPoints: 2,
    awayGoalPoints: 1,
    outcomePoints: 2,
    extraQuestionPoints: 1,
    ...overrides,
  }
}

function makeMemberWithUser(overrides: Partial<MemberWithUser> = {}): MemberWithUser {
  return {
    membershipId: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'user-uuid-1',
    email: 'alice@example.com',
    role: 'member',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    approvedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
}

const PLAYER_PREDICTION: PlayerPredictionEntry = {
  matchId: 'match-uuid-1',
  homeTeamName: 'Germany',
  awayTeamName: 'Scotland',
  scheduledAt: '2026-06-14T16:00:00Z',
  predictedHomeScore: 2,
  predictedAwayScore: 1,
  regulationHomeGoals: 2,
  regulationAwayGoals: 1,
  homeGoalPoint: 1,
  awayGoalPoint: 1,
  outcomePoint: 1,
  totalPoints: 3,
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePredictionScoreRepository(
  overrides: Partial<Record<keyof IPredictionScoreRepository, jest.Mock>> = {},
): IPredictionScoreRepository {
  return {
    upsertBatch: jest.fn().mockResolvedValue(undefined),
    findPredictionsWithQuinielas: jest.fn().mockResolvedValue([]),
    aggregateByQuiniela: jest.fn().mockResolvedValue([]),
    findCrowdOutcomes: jest.fn().mockResolvedValue([]),
    findCrowdOutcomesByMatchIds: jest.fn().mockResolvedValue(new Map()),
    findPlayerPredictionsForViewer: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IPredictionScoreRepository
}

function makeUsersRepository(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  const base = {
    findById: jest.fn().mockResolvedValue({ id: 'user-uuid-1', email: 'alice@example.com' }),
    ...overrides,
  }
  return {
    ...base,
    // Unless overridden, findByIds delegates to findById per id (in order) so
    // existing tests that prime findById sequences keep working unchanged.
    findByIds:
      base.findByIds ??
      jest.fn(async (ids: string[]) => {
        const users = await Promise.all(ids.map((id) => base.findById(id)))
        return users.filter((u) => u !== null && u !== undefined)
      }),
  } as unknown as IUsersRepository
}

function makeMembershipsRepository(
  overrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
): IMembershipsRepository {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByQuinielaAndUser: jest.fn(),
    findAllByQuiniela: jest.fn().mockResolvedValue([]),
    deleteById: jest.fn(),
    countAdmins: jest.fn(),
    approve: jest.fn(),
    isMember: jest.fn(),
    isApprovedMember: jest.fn(),
    countByUser: jest.fn(),
    ...overrides,
  } as unknown as IMembershipsRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getLeaderboard — 4 new breakdown fields
// ---------------------------------------------------------------------------

describe('LeaderboardService – getLeaderboard (point breakdown fields)', () => {
  it('passes through homeGoalPoints, awayGoalPoints, outcomePoints, extraQuestionPoints from aggregate', async () => {
    const agg = makeAggregateRow()
    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([agg]),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue({ id: agg.userId, email: 'alice@example.com' }),
    })

    const service = new LeaderboardService(repo, usersRepo, makeMembershipsRepository())
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    expect(leaderboard).toHaveLength(1)
    const row = leaderboard[0]
    expect(row.homeGoalPoints).toBe(agg.homeGoalPoints)
    expect(row.awayGoalPoints).toBe(agg.awayGoalPoints)
    expect(row.outcomePoints).toBe(agg.outcomePoints)
    expect(row.extraQuestionPoints).toBe(agg.extraQuestionPoints)
  })

  it('includes all existing fields alongside the 4 new ones', async () => {
    const agg = makeAggregateRow({ userId: 'user-A' })
    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([agg]),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue({ id: 'user-A', email: 'bob@example.com' }),
    })

    const service = new LeaderboardService(repo, usersRepo, makeMembershipsRepository())
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    const row = leaderboard[0]
    expect(row.rank).toBe(1)
    expect(row.userId).toBe('user-A')
    expect(row.email).toBe('bob@example.com')
    expect(row.totalPoints).toBe(agg.totalPoints)
    expect(row.exactScoreHits).toBe(agg.exactScoreHits)
    expect(row.correctOutcomeHits).toBe(agg.correctOutcomeHits)
    expect(row.predictedMatchCount).toBe(agg.predictedMatchCount)
    expect(row.homeGoalPoints).toBe(agg.homeGoalPoints)
    expect(row.awayGoalPoints).toBe(agg.awayGoalPoints)
    expect(row.outcomePoints).toBe(agg.outcomePoints)
    expect(row.extraQuestionPoints).toBe(agg.extraQuestionPoints)
  })

  it('zero-score fallback initializes all 4 new fields to 0', async () => {
    // aggregateByQuiniela returns [] → falls back to members list
    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([]),
    })
    const member = makeMemberWithUser({ userId: 'user-B', email: 'carol@example.com' })
    const membershipsRepo = makeMembershipsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([member]),
    })

    const service = new LeaderboardService(repo, makeUsersRepository(), membershipsRepo)
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    expect(leaderboard).toHaveLength(1)
    const row = leaderboard[0]
    expect(row.homeGoalPoints).toBe(0)
    expect(row.awayGoalPoints).toBe(0)
    expect(row.outcomePoints).toBe(0)
    expect(row.extraQuestionPoints).toBe(0)
    expect(row.totalPoints).toBe(0)
  })

  it('resolves all emails with a single batched findByIds call (no per-user queries)', async () => {
    const aggA = makeAggregateRow({ userId: 'user-A' })
    const aggB = makeAggregateRow({ userId: 'user-B' })
    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([aggA, aggB]),
    })
    const findByIds = jest.fn().mockResolvedValue([
      { id: 'user-A', email: 'alice@example.com' },
      { id: 'user-B', email: 'bob@example.com' },
    ])
    const usersRepo = makeUsersRepository({ findByIds })

    const service = new LeaderboardService(repo, usersRepo, makeMembershipsRepository())
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    expect(findByIds).toHaveBeenCalledTimes(1)
    expect(findByIds).toHaveBeenCalledWith(['user-A', 'user-B'])
    expect(leaderboard.map((r) => r.email).sort()).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('falls back to the userId when findByIds omits a user', async () => {
    const agg = makeAggregateRow({ userId: 'user-missing' })
    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([agg]),
    })
    const usersRepo = makeUsersRepository({ findByIds: jest.fn().mockResolvedValue([]) })

    const service = new LeaderboardService(repo, usersRepo, makeMembershipsRepository())
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    expect(leaderboard[0].email).toBe('user-missing')
  })

  it('sorts multiple users and passes 4 breakdown fields for each', async () => {
    const aggHigh = makeAggregateRow({ userId: 'user-high', totalPoints: 10, homeGoalPoints: 3, awayGoalPoints: 3, outcomePoints: 3, extraQuestionPoints: 1 })
    const aggLow = makeAggregateRow({ userId: 'user-low', totalPoints: 2, homeGoalPoints: 0, awayGoalPoints: 1, outcomePoints: 1, extraQuestionPoints: 0 })

    const repo = makePredictionScoreRepository({
      aggregateByQuiniela: jest.fn().mockResolvedValue([aggLow, aggHigh]),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn()
        .mockResolvedValueOnce({ id: 'user-low', email: 'zoe@example.com' })
        .mockResolvedValueOnce({ id: 'user-high', email: 'alice@example.com' }),
    })

    const service = new LeaderboardService(repo, usersRepo, makeMembershipsRepository())
    const leaderboard = await service.getLeaderboard('quiniela-uuid')

    expect(leaderboard[0].userId).toBe('user-high')
    expect(leaderboard[0].homeGoalPoints).toBe(aggHigh.homeGoalPoints)
    expect(leaderboard[1].userId).toBe('user-low')
    expect(leaderboard[1].extraQuestionPoints).toBe(aggLow.extraQuestionPoints)
  })
})

// ---------------------------------------------------------------------------
// getPlayerPredictions
// ---------------------------------------------------------------------------

describe('LeaderboardService – getPlayerPredictions', () => {
  it('delegates to repo.findPlayerPredictionsForViewer and returns result', async () => {
    const mockFindPlayerPredictions = jest.fn().mockResolvedValue([PLAYER_PREDICTION])
    const repo = makePredictionScoreRepository({
      findPlayerPredictionsForViewer: mockFindPlayerPredictions,
    })

    const service = new LeaderboardService(repo, makeUsersRepository(), makeMembershipsRepository())
    const result = await service.getPlayerPredictions('quiniela-uuid', 'user-uuid-1')

    expect(mockFindPlayerPredictions).toHaveBeenCalledWith('quiniela-uuid', 'user-uuid-1')
    expect(result).toEqual([PLAYER_PREDICTION])
  })

  it('returns an empty array when no predictions exist', async () => {
    const repo = makePredictionScoreRepository({
      findPlayerPredictionsForViewer: jest.fn().mockResolvedValue([]),
    })

    const service = new LeaderboardService(repo, makeUsersRepository(), makeMembershipsRepository())
    const result = await service.getPlayerPredictions('quiniela-uuid', 'user-uuid-1')

    expect(result).toEqual([])
  })

  it('propagates repository error as thrown exception', async () => {
    const repo = makePredictionScoreRepository({
      findPlayerPredictionsForViewer: jest.fn().mockRejectedValue(
        new Error('findPlayerPredictionsForViewer failed: DB error'),
      ),
    })

    const service = new LeaderboardService(repo, makeUsersRepository(), makeMembershipsRepository())

    await expect(service.getPlayerPredictions('quiniela-uuid', 'user-uuid-1')).rejects.toThrow(
      'findPlayerPredictionsForViewer failed: DB error',
    )
  })

  it('passes quinielaId and userId to the repository', async () => {
    const mockFindPlayerPredictions = jest.fn().mockResolvedValue([])
    const repo = makePredictionScoreRepository({
      findPlayerPredictionsForViewer: mockFindPlayerPredictions,
    })

    const service = new LeaderboardService(repo, makeUsersRepository(), makeMembershipsRepository())
    await service.getPlayerPredictions('quiniela-X', 'user-Y')

    expect(mockFindPlayerPredictions).toHaveBeenCalledWith('quiniela-X', 'user-Y')
  })
})
