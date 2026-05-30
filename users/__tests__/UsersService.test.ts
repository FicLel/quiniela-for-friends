/**
 * Unit tests for UsersService.listAllUsers.
 *
 * IUsersRepository is mocked at the boundary — no real DB queries.
 * Tests cover: NOT_AUTHORIZED, UNKNOWN_ERROR, all filter combinations,
 * pagination forwarding, and sort forwarding.
 */

import { UsersService } from '../UsersService'
import type { IUsersRepository, UserWithMemberships, UserListFilters, UserListSort } from '../users.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserWithMemberships(overrides: Partial<UserWithMemberships> = {}): UserWithMemberships {
  return {
    id: 'user-uuid',
    email: 'player@example.com',
    name: null,
    memberships: [
      {
        membershipId: 'membership-uuid',
        quinielaId: 'quiniela-uuid',
        quinielaName: 'Liga MX',
        role: 'member',
        approvedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ],
    ...overrides,
  }
}

function makeRepository(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    setMustChangePassword: jest.fn().mockResolvedValue(undefined),
    setPasswordHash: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(null),
    hasAnyUser: jest.fn().mockResolvedValue(false),
    listAll: jest.fn().mockResolvedValue({ users: [makeUserWithMemberships()], total: 1 }),
    findByIdWithMemberships: jest.fn().mockResolvedValue(makeUserWithMemberships()),
    ...overrides,
  } as unknown as IUsersRepository
}

const DEFAULT_FILTERS: UserListFilters = {}
const DEFAULT_SORT: UserListSort = { column: 'email', direction: 'asc' }

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// UsersService.listAllUsers — authorization
// ---------------------------------------------------------------------------

describe('UsersService.listAllUsers — authorization', () => {
  it('returns NOT_AUTHORIZED when callerRole is "player"', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    const result = await service.listAllUsers('player', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: false, error: 'NOT_AUTHORIZED' })
    expect(repo.listAll).not.toHaveBeenCalled()
  })

  it('returns NOT_AUTHORIZED when callerRole is empty string', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    const result = await service.listAllUsers('', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: false, error: 'NOT_AUTHORIZED' })
    expect(repo.listAll).not.toHaveBeenCalled()
  })

  it('returns NOT_AUTHORIZED when callerRole is "superuser" (unrecognised role)', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    const result = await service.listAllUsers('superuser', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: false, error: 'NOT_AUTHORIZED' })
  })

  it('calls the repository when callerRole is "admin"', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// UsersService.listAllUsers — happy path
// ---------------------------------------------------------------------------

describe('UsersService.listAllUsers — happy path', () => {
  it('returns { ok: true, users, total } on success', async () => {
    const users = [makeUserWithMemberships(), makeUserWithMemberships({ id: 'user-2', email: 'b@example.com' })]
    const repo = makeRepository({
      listAll: jest.fn().mockResolvedValue({ users, total: 2 }),
    })
    const service = new UsersService(repo)

    const result = await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: true, users, total: 2 })
  })

  it('passes filters through to the repository unchanged', async () => {
    const filters: UserListFilters = { status: 'pending', quinielaId: 'q-uuid', search: 'foo' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', filters, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      filters,
      expect.objectContaining({ page: 1, pageSize: 20 }),
      DEFAULT_SORT,
    )
  })

  it('passes page number through to the repository', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 3, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      DEFAULT_FILTERS,
      expect.objectContaining({ page: 3 }),
      DEFAULT_SORT,
    )
  })

  it('always uses pageSize of 20 regardless of caller input', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      DEFAULT_FILTERS,
      { page: 1, pageSize: 20 },
      DEFAULT_SORT,
    )
  })

  it('passes sort through to the repository unchanged', async () => {
    const sort: UserListSort = { column: 'name', direction: 'desc' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 1, sort)

    expect(repo.listAll).toHaveBeenCalledWith(DEFAULT_FILTERS, expect.anything(), sort)
  })
})

// ---------------------------------------------------------------------------
// UsersService.listAllUsers — filter scenarios
// ---------------------------------------------------------------------------

describe('UsersService.listAllUsers — filter scenarios', () => {
  it('returns empty list when repository returns no users', async () => {
    const repo = makeRepository({
      listAll: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    })
    const service = new UsersService(repo)

    const result = await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: true, users: [], total: 0 })
  })

  it('passes status=pending filter to the repository', async () => {
    const filters: UserListFilters = { status: 'pending' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', filters, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('passes status=active filter to the repository', async () => {
    const filters: UserListFilters = { status: 'active' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', filters, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('passes quinielaId filter to the repository', async () => {
    const filters: UserListFilters = { quinielaId: 'q-abc' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', filters, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ quinielaId: 'q-abc' }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('passes search filter to the repository', async () => {
    const filters: UserListFilters = { search: 'victor' }
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', filters, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'victor' }),
      expect.anything(),
      expect.anything(),
    )
  })
})

// ---------------------------------------------------------------------------
// UsersService.listAllUsers — error handling
// ---------------------------------------------------------------------------

describe('UsersService.listAllUsers — error handling', () => {
  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const repo = makeRepository({
      listAll: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new UsersService(repo)

    const result = await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns UNKNOWN_ERROR for any thrown error, not just DB errors', async () => {
    const repo = makeRepository({
      listAll: jest.fn().mockRejectedValue('unexpected string error'),
    })
    const service = new UsersService(repo)

    const result = await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(result).toEqual({ ok: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// UsersService.listAllUsers — pagination boundary
// ---------------------------------------------------------------------------

describe('UsersService.listAllUsers — pagination', () => {
  it('forwards page=1 correctly', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 1, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 1 }),
      expect.anything(),
    )
  })

  it('forwards page=10 correctly', async () => {
    const repo = makeRepository()
    const service = new UsersService(repo)

    await service.listAllUsers('admin', DEFAULT_FILTERS, 10, DEFAULT_SORT)

    expect(repo.listAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 10 }),
      expect.anything(),
    )
  })
})
