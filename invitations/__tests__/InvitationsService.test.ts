/**
 * Unit tests for InvitationsService.
 *
 * All repositories and bcryptjs are mocked at the boundary.
 * node:crypto is mocked so we control raw token generation.
 * Tests cover: token generation/hashing security, all error branches,
 * and happy paths for sendInvite, acceptInvite, revokeInvite, listInvitations.
 */

import { InvitationsService } from '../InvitationsService'
import type { IInvitationsRepository, Invitation } from '../invitations.types'
import type { IMembershipsRepository, Membership } from '@/memberships/memberships.types'
import type { IUsersRepository, User } from '@/users/users.types'

// ---------------------------------------------------------------------------
// Mock bcryptjs
// ---------------------------------------------------------------------------

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import bcrypt from 'bcryptjs'
const mockBcryptHash = bcrypt.hash as jest.Mock

// ---------------------------------------------------------------------------
// Mock node:crypto
// ---------------------------------------------------------------------------

jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof import('node:crypto')>('node:crypto')
  return {
    ...actual,
    randomBytes: jest.fn(),
  }
})

import { randomBytes } from 'node:crypto'
const mockRandomBytes = randomBytes as jest.Mock

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const FIXED_RAW_TOKEN = 'a'.repeat(64)
// SHA-256 of 'aaaa...64 a characters'
// We'll compute it via the actual createHash (not mocked) in tests
import { createHash } from 'node:crypto'
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex')

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'invitation-uuid',
    quinielaId: 'quiniela-uuid',
    email: 'invited@example.com',
    roleToAssign: 'member',
    tokenHash: FIXED_TOKEN_HASH,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: 'admin-uuid',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'admin-uuid',
    role: 'admin',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeUserRow(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid',
    email: 'invited@example.com',
    passwordHash: '$2b$12$hash',
    role: 'player',
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeInvitationsRepository(
  overrides: Partial<Record<keyof IInvitationsRepository, jest.Mock>> = {},
): IInvitationsRepository {
  return {
    create: jest.fn().mockResolvedValue(makeInvitation()),
    findByTokenHash: jest.fn().mockResolvedValue(makeInvitation()),
    findActiveByEmailAndQuiniela: jest.fn().mockResolvedValue([]),
    markAccepted: jest.fn().mockResolvedValue(undefined),
    markRevoked: jest.fn().mockResolvedValue(undefined),
    findAllByQuiniela: jest.fn().mockResolvedValue([makeInvitation()]),
    ...overrides,
  } as unknown as IInvitationsRepository
}

function makeMembershipsRepository(
  overrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
): IMembershipsRepository {
  return {
    create: jest.fn().mockResolvedValue(makeMembership()),
    findById: jest.fn().mockResolvedValue(makeMembership()),
    findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership({ role: 'admin' })),
    findAllByQuiniela: jest.fn().mockResolvedValue([]),
    deleteById: jest.fn().mockResolvedValue(undefined),
    countAdmins: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as IMembershipsRepository
}

function makeUsersRepository(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  return {
    findById: jest.fn().mockResolvedValue(makeUserRow()),
    findByEmail: jest.fn().mockResolvedValue(null),
    setMustChangePassword: jest.fn().mockResolvedValue(undefined),
    setPasswordHash: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(makeUserRow()),
    hasAnyUser: jest.fn().mockResolvedValue(false),
    ...overrides,
  } as unknown as IUsersRepository
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: randomBytes returns a buffer that produces our fixed token
  mockRandomBytes.mockReturnValue(Buffer.from(FIXED_RAW_TOKEN, 'hex'))
})

// ---------------------------------------------------------------------------
// InvitationsService.sendInvite
// ---------------------------------------------------------------------------

describe('InvitationsService.sendInvite', () => {
  const BASE_INPUT = {
    quinielaId: 'quiniela-uuid',
    email: 'Invited@Example.com', // mixed case intentional
    roleToAssign: 'member' as const,
    callerUserId: 'admin-uuid',
    baseUrl: 'https://app.example.com',
  }

  it('returns { success: true, invitationId, inviteUrl } on happy path', async () => {
    const invitation = makeInvitation()
    const invRepo = makeInvitationsRepository({
      create: jest.fn().mockResolvedValue(invitation),
    })
    const membRepo = makeMembershipsRepository()
    const usersRepo = makeUsersRepository()
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    const result = await service.sendInvite(BASE_INPUT)

    expect(result).toEqual({
      success: true,
      invitationId: invitation.id,
      inviteUrl: `https://app.example.com/invite/${FIXED_RAW_TOKEN}`,
    })
  })

  it('lowercases and trims the email before processing', async () => {
    const invRepo = makeInvitationsRepository()
    const membRepo = makeMembershipsRepository()
    const usersRepo = makeUsersRepository()
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    await service.sendInvite({ ...BASE_INPUT, email: '  Invited@Example.COM  ' })

    expect(invRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'invited@example.com' }),
    )
  })

  it('stores the hashed token, NOT the raw token', async () => {
    const invRepo = makeInvitationsRepository()
    const membRepo = makeMembershipsRepository()
    const usersRepo = makeUsersRepository()
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    await service.sendInvite(BASE_INPUT)

    expect(invRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: FIXED_TOKEN_HASH }),
    )
    // The raw token must NOT appear in the stored hash
    const call = (invRepo.create as jest.Mock).mock.calls[0][0]
    expect(call.tokenHash).not.toBe(FIXED_RAW_TOKEN)
  })

  it('inviteUrl contains the raw token, NOT the hash', async () => {
    const invRepo = makeInvitationsRepository()
    const membRepo = makeMembershipsRepository()
    const usersRepo = makeUsersRepository()
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    const result = await service.sendInvite(BASE_INPUT)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.inviteUrl).toContain(FIXED_RAW_TOKEN)
      expect(result.inviteUrl).not.toContain(FIXED_TOKEN_HASH)
    }
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has no membership', async () => {
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      membRepo,
      makeUsersRepository(),
    )

    const result = await service.sendInvite(BASE_INPUT)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has role=member', async () => {
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership({ role: 'member' })),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      membRepo,
      makeUsersRepository(),
    )

    const result = await service.sendInvite(BASE_INPUT)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
  })

  it('returns ALREADY_A_MEMBER when invited email already has a membership', async () => {
    const existingUser = makeUserRow({ id: 'existing-user-uuid', email: 'invited@example.com' })
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(existingUser),
    })
    const membRepo = makeMembershipsRepository({
      // First call: caller check (admin); second call: invited user check (member exists)
      findByQuinielaAndUser: jest.fn()
        .mockResolvedValueOnce(makeMembership({ role: 'admin' }))
        .mockResolvedValueOnce(makeMembership({ userId: existingUser.id, role: 'member' })),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      membRepo,
      usersRepo,
    )

    const result = await service.sendInvite(BASE_INPUT)

    expect(result).toEqual({ success: false, error: 'ALREADY_A_MEMBER' })
  })

  it('revokes existing active invitations for the same email+quiniela before creating a new one', async () => {
    const existingActive = makeInvitation({ id: 'old-invitation-uuid' })
    const invRepo = makeInvitationsRepository({
      findActiveByEmailAndQuiniela: jest.fn().mockResolvedValue([existingActive]),
      markRevoked: jest.fn().mockResolvedValue(undefined),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    await service.sendInvite(BASE_INPUT)

    expect(invRepo.markRevoked).toHaveBeenCalledWith('old-invitation-uuid')
    expect(invRepo.create).toHaveBeenCalled()
  })

  it('does NOT revoke already-accepted invitations — only active ones are revoked', async () => {
    // findActiveByEmailAndQuiniela only returns pending invitations (not accepted),
    // so the service never sees accepted invitations in this list.
    const invRepo = makeInvitationsRepository({
      findActiveByEmailAndQuiniela: jest.fn().mockResolvedValue([]), // accepted ones not in active list
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    await service.sendInvite(BASE_INPUT)

    expect(invRepo.markRevoked).not.toHaveBeenCalled()
    expect(invRepo.create).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// InvitationsService.acceptInvite — token validation checks
// ---------------------------------------------------------------------------

describe('InvitationsService.acceptInvite — token checks', () => {
  it('returns TOKEN_NOT_FOUND when no invitation matches the hashed token', async () => {
    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.acceptInvite({
      rawToken: 'nonexistent-token',
      callerUserId: 'user-uuid',
    })

    expect(result).toEqual({ success: false, error: 'TOKEN_NOT_FOUND' })
  })

  it('returns TOKEN_EXPIRED when invitation expiresAt is in the past', async () => {
    const expired = makeInvitation({
      expiresAt: new Date('2020-01-01T00:00:00Z'), // past date
    })
    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(expired),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.acceptInvite({ rawToken: FIXED_RAW_TOKEN, callerUserId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'TOKEN_EXPIRED' })
  })

  it('returns TOKEN_REVOKED when invitation has revokedAt set', async () => {
    const revoked = makeInvitation({ revokedAt: new Date('2026-01-01T00:00:00Z') })
    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(revoked),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.acceptInvite({ rawToken: FIXED_RAW_TOKEN, callerUserId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'TOKEN_REVOKED' })
  })

  it('returns TOKEN_ALREADY_ACCEPTED when invitation has acceptedAt set', async () => {
    const accepted = makeInvitation({ acceptedAt: new Date('2026-01-01T00:00:00Z') })
    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(accepted),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.acceptInvite({ rawToken: FIXED_RAW_TOKEN, callerUserId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'TOKEN_ALREADY_ACCEPTED' })
  })
})

// ---------------------------------------------------------------------------
// InvitationsService.acceptInvite — existing logged-in user
// ---------------------------------------------------------------------------

describe('InvitationsService.acceptInvite — existing logged-in user', () => {
  it('returns { success: true, quinielaId, wasNewUser: false } when emails match', async () => {
    const invitation = makeInvitation({ email: 'invited@example.com' })
    const callerUser = makeUserRow({ id: 'caller-uuid', email: 'invited@example.com' })

    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(invitation),
      markAccepted: jest.fn().mockResolvedValue(undefined),
    })
    const membRepo = makeMembershipsRepository({
      create: jest.fn().mockResolvedValue(makeMembership()),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue(callerUser),
    })
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: 'caller-uuid',
    })

    expect(result).toEqual({ success: true, quinielaId: 'quiniela-uuid', wasNewUser: false })
    expect(membRepo.create).toHaveBeenCalledWith({
      quinielaId: 'quiniela-uuid',
      userId: 'caller-uuid',
      role: 'member',
    })
    expect(invRepo.markAccepted).toHaveBeenCalledWith('invitation-uuid')
  })

  it('returns EMAIL_MISMATCH when caller email does not match invitation email', async () => {
    const invitation = makeInvitation({ email: 'invited@example.com' })
    const callerUser = makeUserRow({ id: 'caller-uuid', email: 'different@example.com' })

    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(invitation),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue(callerUser),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), usersRepo)

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: 'caller-uuid',
    })

    expect(result).toEqual({ success: false, error: 'EMAIL_MISMATCH' })
  })

  it('returns EMAIL_MISMATCH when caller user is not found', async () => {
    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(makeInvitation()),
    })
    const usersRepo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), usersRepo)

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: 'caller-uuid',
    })

    expect(result).toEqual({ success: false, error: 'EMAIL_MISMATCH' })
  })
})

// ---------------------------------------------------------------------------
// InvitationsService.acceptInvite — new user path (callerUserId=null)
// ---------------------------------------------------------------------------

describe('InvitationsService.acceptInvite — new user path', () => {
  it('returns { success: true, quinielaId, wasNewUser: true } on happy path', async () => {
    mockBcryptHash.mockResolvedValueOnce('$2b$12$newhash')
    const newUser = makeUserRow({ id: 'new-user-uuid', email: 'invited@example.com' })

    const invRepo = makeInvitationsRepository({
      findByTokenHash: jest.fn().mockResolvedValue(makeInvitation()),
      markAccepted: jest.fn().mockResolvedValue(undefined),
    })
    const membRepo = makeMembershipsRepository({
      create: jest.fn().mockResolvedValue(makeMembership()),
    })
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null), // email does not exist yet
      create: jest.fn().mockResolvedValue(newUser),
    })
    const service = new InvitationsService(invRepo, membRepo, usersRepo)

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: null,
      newPassword: 'SecurePass123',
    })

    expect(result).toEqual({ success: true, quinielaId: 'quiniela-uuid', wasNewUser: true })
    expect(usersRepo.create).toHaveBeenCalledWith({
      email: 'invited@example.com',
      passwordHash: '$2b$12$newhash',
      role: 'player',
      mustChangePassword: false,
    })
    expect(membRepo.create).toHaveBeenCalledWith({
      quinielaId: 'quiniela-uuid',
      userId: 'new-user-uuid',
      role: 'member',
    })
    expect(invRepo.markAccepted).toHaveBeenCalledWith('invitation-uuid')
  })

  it('returns EMAIL_MISMATCH when email already exists in DB (user has account but is not logged in)', async () => {
    const existingUser = makeUserRow({ email: 'invited@example.com' })
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(existingUser),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      makeMembershipsRepository(),
      usersRepo,
    )

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: null,
      newPassword: 'SecurePass123',
    })

    expect(result).toEqual({ success: false, error: 'EMAIL_MISMATCH' })
  })

  it('returns PASSWORD_REQUIRED when newPassword is not provided', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      makeMembershipsRepository(),
      usersRepo,
    )

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: null,
      // newPassword omitted
    })

    expect(result).toEqual({ success: false, error: 'PASSWORD_REQUIRED' })
  })

  it('returns WEAK_PASSWORD when newPassword is shorter than 8 characters', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      makeMembershipsRepository(),
      usersRepo,
    )

    const result = await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: null,
      newPassword: 'short',
    })

    expect(result).toEqual({ success: false, error: 'WEAK_PASSWORD' })
  })

  it('creates the user with mustChangePassword: false', async () => {
    mockBcryptHash.mockResolvedValueOnce('$2b$12$newhash')
    const newUser = makeUserRow({ id: 'new-user-uuid' })

    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(newUser),
    })
    const service = new InvitationsService(
      makeInvitationsRepository(),
      makeMembershipsRepository(),
      usersRepo,
    )

    await service.acceptInvite({
      rawToken: FIXED_RAW_TOKEN,
      callerUserId: null,
      newPassword: 'SecurePass123',
    })

    expect(usersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false }),
    )
  })
})

// ---------------------------------------------------------------------------
// InvitationsService.revokeInvite
// ---------------------------------------------------------------------------

describe('InvitationsService.revokeInvite', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const INVITATION_ID = 'invitation-uuid'
  const CALLER_USER_ID = 'admin-uuid'

  it('returns { success: true } on happy path', async () => {
    const invitation = makeInvitation({ id: INVITATION_ID })
    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([invitation]),
      markRevoked: jest.fn().mockResolvedValue(undefined),
    })
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership({ role: 'admin' })),
    })
    const service = new InvitationsService(invRepo, membRepo, makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: true })
    expect(invRepo.markRevoked).toHaveBeenCalledWith(INVITATION_ID)
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has no membership', async () => {
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(makeInvitationsRepository(), membRepo, makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller has role=member', async () => {
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(makeMembership({ role: 'member' })),
    })
    const service = new InvitationsService(makeInvitationsRepository(), membRepo, makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
  })

  it('returns INVITATION_NOT_FOUND when no invitation with that id exists in the quiniela', async () => {
    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([
        makeInvitation({ id: 'different-invitation-uuid' }),
      ]),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'INVITATION_NOT_FOUND' })
  })

  it('returns ALREADY_ACCEPTED when invitation has acceptedAt set', async () => {
    const accepted = makeInvitation({
      id: INVITATION_ID,
      acceptedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([accepted]),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'ALREADY_ACCEPTED' })
  })

  it('returns ALREADY_REVOKED when invitation has revokedAt set', async () => {
    const revoked = makeInvitation({
      id: INVITATION_ID,
      revokedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([revoked]),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.revokeInvite(INVITATION_ID, QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'ALREADY_REVOKED' })
  })
})

// ---------------------------------------------------------------------------
// Token security: stored hash !== raw token
// ---------------------------------------------------------------------------

describe('Token security', () => {
  it('stored tokenHash is different from the raw token', async () => {
    const invRepo = makeInvitationsRepository()
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    await service.sendInvite({
      quinielaId: 'quiniela-uuid',
      email: 'invited@example.com',
      roleToAssign: 'member',
      callerUserId: 'admin-uuid',
      baseUrl: 'https://app.example.com',
    })

    const createCall = (invRepo.create as jest.Mock).mock.calls[0][0]
    expect(createCall.tokenHash).not.toBe(FIXED_RAW_TOKEN)
    expect(createCall.tokenHash).toBe(FIXED_TOKEN_HASH)
  })

  it('inviteUrl contains the raw token (not the hash), so the link works', async () => {
    const invRepo = makeInvitationsRepository()
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.sendInvite({
      quinielaId: 'quiniela-uuid',
      email: 'invited@example.com',
      roleToAssign: 'member',
      callerUserId: 'admin-uuid',
      baseUrl: 'https://app.example.com',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.inviteUrl).toContain(`/invite/${FIXED_RAW_TOKEN}`)
      expect(result.inviteUrl).not.toContain(FIXED_TOKEN_HASH)
    }
  })
})

// ---------------------------------------------------------------------------
// InvitationsService.listInvitations
// ---------------------------------------------------------------------------

describe('InvitationsService.listInvitations', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const CALLER_USER_ID = 'admin-uuid'

  it('returns { success: true, invitations } with computed status on happy path', async () => {
    const pending = makeInvitation({ id: 'inv-1' })
    const accepted = makeInvitation({ id: 'inv-2', acceptedAt: new Date('2026-01-02T00:00:00Z') })
    const revoked = makeInvitation({ id: 'inv-3', revokedAt: new Date('2026-01-03T00:00:00Z') })
    const expired = makeInvitation({
      id: 'inv-4',
      expiresAt: new Date('2020-01-01T00:00:00Z'),
    })

    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockResolvedValue([pending, accepted, revoked, expired]),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.listInvitations(QUINIELA_ID, CALLER_USER_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.invitations).toHaveLength(4)
      expect(result.invitations.find((i) => i.id === 'inv-1')?.status).toBe('pending')
      expect(result.invitations.find((i) => i.id === 'inv-2')?.status).toBe('accepted')
      expect(result.invitations.find((i) => i.id === 'inv-3')?.status).toBe('revoked')
      expect(result.invitations.find((i) => i.id === 'inv-4')?.status).toBe('expired')
    }
  })

  it('returns CALLER_NOT_QUINIELA_ADMIN when caller is not an admin', async () => {
    const membRepo = makeMembershipsRepository({
      findByQuinielaAndUser: jest.fn().mockResolvedValue(null),
    })
    const service = new InvitationsService(makeInvitationsRepository(), membRepo, makeUsersRepository())

    const result = await service.listInvitations(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' })
  })

  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const invRepo = makeInvitationsRepository({
      findAllByQuiniela: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new InvitationsService(invRepo, makeMembershipsRepository(), makeUsersRepository())

    const result = await service.listInvitations(QUINIELA_ID, CALLER_USER_ID)

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})
