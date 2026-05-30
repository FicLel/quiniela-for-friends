/**
 * Unit tests for MembershipsService.
 *
 * IMembershipsRepository is mocked at the boundary — no real DB queries are made.
 * Tests cover business logic only: branching, error mapping, and happy paths.
 */

import { MembershipsService } from '../MembershipsService'
import type { IMembershipsRepository, Membership, MemberWithUser } from '../memberships.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'user-uuid',
    role: 'admin',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeMemberWithUser(overrides: Partial<MemberWithUser> = {}): MemberWithUser {
  return {
    membershipId: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'user-uuid',
    email: 'user@example.com',
    role: 'admin',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeRepository(
  overrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
): IMembershipsRepository {
  return {
    create: jest.fn().mockResolvedValue(makeMembership()),
    findById: jest.fn().mockResolvedValue(makeMembership()),
    findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership()),
    findAllByQuiniela: jest.fn().mockResolvedValue([makeMemberWithUser()]),
    deleteById: jest.fn().mockResolvedValue(undefined),
    countAdmins: jest.fn().mockResolvedValue(2),
    ...overrides,
  } as unknown as IMembershipsRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// MembershipsService.listMembers
// ---------------------------------------------------------------------------

describe('MembershipsService.listMembers', () => {
  it('returns { success: true, members } on happy path', async () => {
    const members = [makeMemberWithUser(), makeMemberWithUser({ membershipId: 'membership-uuid-2', userId: 'user-uuid-2' })]
    const repo = makeRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue(members),
    })
    const service = new MembershipsService(repo)

    const result = await service.listMembers('quiniela-uuid')

    expect(result).toEqual({ success: true, members })
  })

  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const repo = makeRepository({
      findAllByQuiniela: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new MembershipsService(repo)

    const result = await service.listMembers('quiniela-uuid')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// MembershipsService.removeMember
// ---------------------------------------------------------------------------

describe('MembershipsService.removeMember', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const CALLER_USER_ID = 'admin-user-uuid'
  const TARGET_MEMBERSHIP_ID = 'target-membership-uuid'

  it('returns { success: true } when caller is admin and target is a member', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'admin' })
    const targetMembership = makeMembership({ id: TARGET_MEMBERSHIP_ID, userId: 'target-user-uuid', role: 'member' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      findById: jest.fn().mockResolvedValue(targetMembership),
      deleteById: jest.fn().mockResolvedValue(undefined),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: true })
    expect(repo.deleteById).toHaveBeenCalledWith(TARGET_MEMBERSHIP_ID)
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has role=member', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'member' })
    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has no membership in the quiniela', async () => {
    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(null),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns CANNOT_REMOVE_ADMIN when target membership has role=admin', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'admin' })
    const targetMembership = makeMembership({ id: TARGET_MEMBERSHIP_ID, userId: 'other-admin-uuid', role: 'admin' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      findById: jest.fn().mockResolvedValue(targetMembership),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CANNOT_REMOVE_ADMIN' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns MEMBERSHIP_NOT_FOUND when target membership belongs to a different quiniela', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'admin' })
    const targetMembership = makeMembership({
      id: TARGET_MEMBERSHIP_ID,
      quinielaId: 'different-quiniela-uuid', // belongs to a different quiniela
      role: 'member',
    })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      findById: jest.fn().mockResolvedValue(targetMembership),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'MEMBERSHIP_NOT_FOUND' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns MEMBERSHIP_NOT_FOUND when target membership does not exist', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'admin' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      findById: jest.fn().mockResolvedValue(null),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'MEMBERSHIP_NOT_FOUND' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns UNKNOWN_ERROR when repository throws unexpectedly', async () => {
    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new MembershipsService(repo)

    const result = await service.removeMember(QUINIELA_ID, TARGET_MEMBERSHIP_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// MembershipsService.leaveQuiniela
// ---------------------------------------------------------------------------

describe('MembershipsService.leaveQuiniela', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const CALLER_USER_ID = 'admin-user-uuid'

  it('returns { success: true } when caller is admin and there are 2+ admins', async () => {
    const callerMembership = makeMembership({ id: 'caller-membership-uuid', userId: CALLER_USER_ID, role: 'admin' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      countAdmins: jest.fn().mockResolvedValue(2),
      deleteById: jest.fn().mockResolvedValue(undefined),
    })
    const service = new MembershipsService(repo)

    const result = await service.leaveQuiniela(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: true })
    expect(repo.deleteById).toHaveBeenCalledWith('caller-membership-uuid')
  })

  it('returns LAST_ADMIN_CANNOT_LEAVE when caller is the only admin', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'admin' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
      countAdmins: jest.fn().mockResolvedValue(1),
    })
    const service = new MembershipsService(repo)

    const result = await service.leaveQuiniela(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'LAST_ADMIN_CANNOT_LEAVE' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns NOT_A_MEMBER when caller has role=member (members cannot self-leave)', async () => {
    const callerMembership = makeMembership({ userId: CALLER_USER_ID, role: 'member' })

    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(callerMembership),
    })
    const service = new MembershipsService(repo)

    const result = await service.leaveQuiniela(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'NOT_A_MEMBER' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns MEMBERSHIP_NOT_FOUND when caller has no membership in the quiniela', async () => {
    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(null),
    })
    const service = new MembershipsService(repo)

    const result = await service.leaveQuiniela(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'MEMBERSHIP_NOT_FOUND' })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns UNKNOWN_ERROR when repository throws unexpectedly', async () => {
    const repo = makeRepository({
      findByQuinielaAndUser: jest.fn().mockRejectedValue(new Error('DB timeout')),
    })
    const service = new MembershipsService(repo)

    const result = await service.leaveQuiniela(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})
