/**
 * Unit tests for ImpersonationService — admin "View as User" (read-only
 * impersonation) feature.
 *
 * IUsersRepository is mocked at the boundary. ImpersonationService.start
 * receives an already-normalized (trim + lowercase) email.
 */

import { ImpersonationService } from '../ImpersonationService'
import type { IUsersRepository, User } from '@/users/users.types'
import type { SessionPayload } from '@/auth/AuthClient'

function makeUserRow(overrides: Partial<User> = {}): User {
  return {
    id: 'target-uuid',
    email: 'player@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'player',
    mustChangePassword: false,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeAdminSession(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    sub: 'admin-uuid',
    email: 'admin@example.com',
    role: 'admin',
    mustChangePassword: false,
    tokenVersion: 1,
    ...overrides,
  }
}

function makeUsersRepository(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByIds: jest.fn().mockResolvedValue([]),
    findByEmail: jest.fn().mockResolvedValue(makeUserRow()),
    setMustChangePassword: jest.fn().mockResolvedValue(undefined),
    setPasswordHash: jest.fn().mockResolvedValue(undefined),
    incrementTokenVersion: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(makeUserRow()),
    hasAnyUser: jest.fn().mockResolvedValue(true),
    listAll: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    findByIdWithMemberships: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as IUsersRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ImpersonationService.start', () => {
  // AC-3: only admins may start impersonation
  it('returns NOT_ADMIN when the caller is not an admin', async () => {
    const usersRepo = makeUsersRepository()
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession({ role: 'player' })
    const result = await service.start(adminSession, 'player@example.com')

    expect(result).toEqual({ success: false, error: 'NOT_ADMIN' })
    expect(usersRepo.findByEmail).not.toHaveBeenCalled()
  })

  // AC-2: target user must exist
  it('returns USER_NOT_FOUND when the target email does not match any user', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    })
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession()
    const result = await service.start(adminSession, 'nobody@example.com')

    expect(result).toEqual({ success: false, error: 'USER_NOT_FOUND' })
    expect(usersRepo.findByEmail).toHaveBeenCalledWith('nobody@example.com')
  })

  // AC-11: cannot impersonate another admin
  it('returns CANNOT_IMPERSONATE_ADMIN when the target is a different admin', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(
        makeUserRow({ id: 'other-admin-uuid', email: 'other-admin@example.com', role: 'admin' }),
      ),
    })
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession()
    const result = await service.start(adminSession, 'other-admin@example.com')

    expect(result).toEqual({ success: false, error: 'CANNOT_IMPERSONATE_ADMIN' })
  })

  // AC-12: self-impersonation is a harmless no-op, using the admin's own identity
  it('succeeds with the admin own identity for self-impersonation (target.id === session.sub)', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(
        makeUserRow({ id: 'admin-uuid', email: 'admin@example.com', role: 'admin' }),
      ),
    })
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession()
    const result = await service.start(adminSession, 'admin@example.com')

    expect(result).toEqual({
      success: true,
      impersonating: { userId: 'admin-uuid', email: 'admin@example.com' },
    })
  })

  // Happy path: impersonating a regular player
  it('succeeds with the target player identity', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(
        makeUserRow({ id: 'player-uuid', email: 'player@example.com', role: 'player' }),
      ),
    })
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession()
    const result = await service.start(adminSession, 'player@example.com')

    expect(result).toEqual({
      success: true,
      impersonating: { userId: 'player-uuid', email: 'player@example.com' },
    })
  })

  // AC-13: switching targets while already impersonating — service has no
  // special-casing; it always resolves the new target from the admin's real
  // session (session.sub/email are never overwritten by impersonation).
  it('resolves a new target even when the admin session is currently impersonating someone else', async () => {
    const usersRepo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(
        makeUserRow({ id: 'second-player-uuid', email: 'second-player@example.com', role: 'player' }),
      ),
    })
    const service = new ImpersonationService(usersRepo)

    // adminSession.sub/email/role always represent the REAL admin, even while impersonating.
    const adminSession = makeAdminSession({
      impersonating: { userId: 'first-player-uuid', email: 'first-player@example.com' },
    })
    const result = await service.start(adminSession, 'second-player@example.com')

    expect(result).toEqual({
      success: true,
      impersonating: { userId: 'second-player-uuid', email: 'second-player@example.com' },
    })
  })

  // Email normalization is the caller's responsibility — service uses the
  // email as-is for the repository lookup.
  it('passes the email through to findByEmail unchanged (caller normalizes)', async () => {
    const usersRepo = makeUsersRepository()
    const service = new ImpersonationService(usersRepo)

    const adminSession = makeAdminSession()
    await service.start(adminSession, 'already-normalized@example.com')

    expect(usersRepo.findByEmail).toHaveBeenCalledWith('already-normalized@example.com')
  })
})
