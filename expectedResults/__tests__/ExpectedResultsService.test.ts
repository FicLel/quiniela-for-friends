/**
 * Unit tests for ExpectedResultsService.
 *
 * Both IExpectedResultsRepository and IMembershipsRepository are mocked at the
 * boundary — no real DB queries are made. Tests cover business logic only:
 * approval gate, score validation, repository delegation, and error mapping.
 */

import { ExpectedResultsService } from '../ExpectedResultsService'
import type { IExpectedResultsRepository, IMatchKickoffReader, ExpectedResult } from '../expectedResults.types'
import type { IMembershipsRepository, Membership } from '@/memberships/memberships.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpectedResult(overrides: Partial<ExpectedResult> = {}): ExpectedResult {
  return {
    id: 'result-uuid',
    userId: 'user-uuid',
    matchId: 'match-uuid',
    homeScore: 2,
    awayScore: 1,
    lockedAt: null,
    submittedAt: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  }
}

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'user-uuid',
    role: 'member',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    approvedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeExpectedResultsRepository(
  overrides: Partial<Record<keyof IExpectedResultsRepository, jest.Mock>> = {},
): IExpectedResultsRepository {
  return {
    upsert: jest.fn().mockResolvedValue(undefined),
    findByUserId: jest.fn().mockResolvedValue([]),
    deleteByUserId: jest.fn().mockResolvedValue(undefined),
    findByMatchId: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IExpectedResultsRepository
}

function makeKickoffReader(kickoffAt: Date | null = null): IMatchKickoffReader {
  return {
    findKickoffAt: jest.fn().mockResolvedValue(kickoffAt),
  }
}

function makeMembershipsRepository(
  overrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
): IMembershipsRepository {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeMembership()),
    findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership()),
    findAllByQuiniela: jest.fn().mockResolvedValue([]),
    deleteById: jest.fn().mockResolvedValue(undefined),
    countAdmins: jest.fn().mockResolvedValue(1),
    approve: jest.fn().mockResolvedValue(undefined),
    isMember: jest.fn().mockResolvedValue(false),
    countByUser: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as IMembershipsRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// ExpectedResultsService.isUserApproved
// ---------------------------------------------------------------------------

describe('ExpectedResultsService.isUserApproved', () => {
  it('returns true when user has one approved membership', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.isUserApproved('user-uuid')

    expect(result).toBe(true)
    expect(membershipsRepo.countByUser).toHaveBeenCalledWith('user-uuid')
  })

  it('returns false when all memberships have approvedAt = null (count = 0)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(0),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.isUserApproved('user-uuid')

    expect(result).toBe(false)
  })

  it('returns false when user has zero memberships (count = 0)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(0),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.isUserApproved('user-no-memberships')

    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ExpectedResultsService.getExpectedResultsForUser
// ---------------------------------------------------------------------------

describe('ExpectedResultsService.getExpectedResultsForUser', () => {
  it('returns [] when the user has no predictions', async () => {
    const repo = makeExpectedResultsRepository({
      findByUserId: jest.fn().mockResolvedValue([]),
    })
    const service = new ExpectedResultsService(repo, makeMembershipsRepository())

    const result = await service.getExpectedResultsForUser('user-uuid')

    expect(result).toEqual([])
    expect(repo.findByUserId).toHaveBeenCalledWith('user-uuid')
  })

  it('returns the predictions returned by the repository', async () => {
    const predictions = [makeExpectedResult(), makeExpectedResult({ id: 'result-uuid-2', matchId: 'match-uuid-2' })]
    const repo = makeExpectedResultsRepository({
      findByUserId: jest.fn().mockResolvedValue(predictions),
    })
    const service = new ExpectedResultsService(repo, makeMembershipsRepository())

    const result = await service.getExpectedResultsForUser('user-uuid')

    expect(result).toEqual(predictions)
  })
})

// ---------------------------------------------------------------------------
// ExpectedResultsService.upsertExpectedResult
// ---------------------------------------------------------------------------

describe('ExpectedResultsService.upsertExpectedResult', () => {
  const USER_ID = 'user-uuid'
  const MATCH_ID = 'match-uuid'

  it('returns { success: true } for approved user with valid scores', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository({
      upsert: jest.fn().mockResolvedValue(undefined),
    })
    const service = new ExpectedResultsService(repo, membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: true })
    expect(repo.upsert).toHaveBeenCalledWith({
      userId: USER_ID,
      matchId: MATCH_ID,
      homeScore: 2,
      awayScore: 1,
    })
  })

  it('returns NOT_APPROVED and never calls upsert for non-approved user', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(0),
    })
    const repo = makeExpectedResultsRepository()
    const service = new ExpectedResultsService(repo, membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: false, error: 'NOT_APPROVED' })
    expect(repo.upsert).not.toHaveBeenCalled()
  })

  it('returns INVALID_SCORE when homeScore is -1', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, -1, 0)

    expect(result).toEqual({ success: false, error: 'INVALID_SCORE' })
  })

  it('returns INVALID_SCORE when awayScore is -1', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 0, -1)

    expect(result).toEqual({ success: false, error: 'INVALID_SCORE' })
  })

  it('returns INVALID_SCORE when homeScore is 1.5 (not an integer)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const service = new ExpectedResultsService(makeExpectedResultsRepository(), membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 1.5, 0)

    expect(result).toEqual({ success: false, error: 'INVALID_SCORE' })
  })

  it('returns { success: true } for homeScore = 0, awayScore = 0 (edge: valid zero scores)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository({
      upsert: jest.fn().mockResolvedValue(undefined),
    })
    const service = new ExpectedResultsService(repo, membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 0, 0)

    expect(result).toEqual({ success: true })
    expect(repo.upsert).toHaveBeenCalledWith({
      userId: USER_ID,
      matchId: MATCH_ID,
      homeScore: 0,
      awayScore: 0,
    })
  })

  it('returns UNKNOWN_ERROR when repository.upsert throws', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository({
      upsert: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new ExpectedResultsService(repo, membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns LOCKED when kickoffAt is in the past', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository()
    const kickoffReader = makeKickoffReader(new Date('2020-01-01T00:00:00Z')) // past
    const service = new ExpectedResultsService(repo, membershipsRepo, kickoffReader)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: false, error: 'LOCKED' })
    expect(repo.upsert).not.toHaveBeenCalled()
  })

  it('returns LOCKED when kickoffAt equals now (boundary: kickoffAt <= now)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository()
    // Use a Date in the past to reliably trigger <= now
    const kickoffReader = makeKickoffReader(new Date(Date.now() - 1))
    const service = new ExpectedResultsService(repo, membershipsRepo, kickoffReader)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: false, error: 'LOCKED' })
    expect(repo.upsert).not.toHaveBeenCalled()
  })

  it('returns { success: true } when kickoffAt is in the future', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository({
      upsert: jest.fn().mockResolvedValue(undefined),
    })
    const kickoffReader = makeKickoffReader(new Date('2099-01-01T00:00:00Z')) // future
    const service = new ExpectedResultsService(repo, membershipsRepo, kickoffReader)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: true })
    expect(repo.upsert).toHaveBeenCalledTimes(1)
  })

  it('returns { success: true } when no kickoffReader is provided (backwards-compatible)', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository({
      upsert: jest.fn().mockResolvedValue(undefined),
    })
    // No kickoffReader injected — lock gate is bypassed
    const service = new ExpectedResultsService(repo, membershipsRepo)

    const result = await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(result).toEqual({ success: true })
    expect(repo.upsert).toHaveBeenCalledTimes(1)
  })

  it('does not call repository.upsert when LOCKED', async () => {
    const membershipsRepo = makeMembershipsRepository({
      countByUser: jest.fn().mockResolvedValue(1),
    })
    const repo = makeExpectedResultsRepository()
    const kickoffReader = makeKickoffReader(new Date('2020-06-01T00:00:00Z'))
    const service = new ExpectedResultsService(repo, membershipsRepo, kickoffReader)

    await service.upsertExpectedResult(USER_ID, MATCH_ID, 2, 1)

    expect(repo.upsert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ExpectedResultsService.deleteExpectedResultsForUser
// ---------------------------------------------------------------------------

describe('ExpectedResultsService.deleteExpectedResultsForUser', () => {
  it('delegates to repository.deleteByUserId with the correct userId', async () => {
    const repo = makeExpectedResultsRepository({
      deleteByUserId: jest.fn().mockResolvedValue(undefined),
    })
    const service = new ExpectedResultsService(repo, makeMembershipsRepository())

    await service.deleteExpectedResultsForUser('user-uuid')

    expect(repo.deleteByUserId).toHaveBeenCalledWith('user-uuid')
    expect(repo.deleteByUserId).toHaveBeenCalledTimes(1)
  })

  it('resolves without error when repository.deleteByUserId resolves', async () => {
    const repo = makeExpectedResultsRepository({
      deleteByUserId: jest.fn().mockResolvedValue(undefined),
    })
    const service = new ExpectedResultsService(repo, makeMembershipsRepository())

    await expect(service.deleteExpectedResultsForUser('user-uuid')).resolves.toBeUndefined()
  })

  it('propagates errors thrown by repository.deleteByUserId', async () => {
    const repo = makeExpectedResultsRepository({
      deleteByUserId: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new ExpectedResultsService(repo, makeMembershipsRepository())

    await expect(service.deleteExpectedResultsForUser('user-uuid')).rejects.toThrow('DB error')
  })
})
