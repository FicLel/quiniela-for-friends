/**
 * Unit tests for AuthService (Email + Password flow with custom JWT).
 *
 * AuthClient and IUsersRepository are mocked at the boundary — no real
 * bcrypt calls, DB queries, or JWT operations are made. Tests cover
 * business logic only: branching, error mapping, and happy paths.
 */

import { AuthService } from '../AuthService'
import type { AuthClient } from '../AuthClient'
import type { IUsersRepository, User } from '@/users/users.types'

// ---------------------------------------------------------------------------
// Mock bcryptjs so tests run fast without real hash rounds
// ---------------------------------------------------------------------------

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

import bcrypt from 'bcryptjs'
const mockCompare = bcrypt.compare as jest.Mock
const mockHash = bcrypt.hash as jest.Mock

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal User row for repository mock returns. */
function makeUserRow(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid',
    email: 'player@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'player',
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Build a minimal AuthClient mock.
 */
function makeAuthClient(
  overrides: Partial<Record<keyof AuthClient, jest.Mock>> = {},
): AuthClient {
  return {
    createToken: jest.fn().mockResolvedValue('mock-jwt-token'),
    verifyToken: jest.fn().mockResolvedValue({ sub: 'user-uuid', email: 'player@example.com', role: 'player', mustChangePassword: false }),
    buildSessionCookieValue: jest.fn(),
    buildClearSessionCookieValue: jest.fn(),
    getTokenFromServerAction: jest.fn().mockResolvedValue('mock-jwt-token'),
    setSessionCookieOnServerAction: jest.fn().mockResolvedValue(undefined),
    getTokenFromRequest: jest.fn().mockReturnValue('mock-jwt-token'),
    ...overrides,
  } as unknown as AuthClient
}

/**
 * Build a minimal IUsersRepository mock.
 */
function makeUsersRepository(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  return {
    findById: jest.fn().mockResolvedValue(makeUserRow()),
    findByEmail: jest.fn().mockResolvedValue(makeUserRow()),
    setMustChangePassword: jest.fn().mockResolvedValue(undefined),
    setPasswordHash: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(makeUserRow({ role: 'admin', mustChangePassword: true })),
    hasAnyUser: jest.fn().mockResolvedValue(false),
    ...overrides,
  } as unknown as IUsersRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// AuthService.login
// ---------------------------------------------------------------------------

describe('AuthService.login', () => {
  it('returns { success: true, token, mustChangePassword: true } when user has mustChangePassword: true', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(makeUserRow({ mustChangePassword: true })),
    })
    const service = new AuthService(client, repo)

    const result = await service.login('player@example.com', 'Password1')

    expect(result).toEqual({ success: true, token: 'mock-jwt-token', mustChangePassword: true })
    expect(client.createToken).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }))
  })

  it('returns { success: true, token, mustChangePassword: false } when user has mustChangePassword: false', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(makeUserRow({ mustChangePassword: false })),
    })
    const service = new AuthService(client, repo)

    const result = await service.login('player@example.com', 'Password1')

    expect(result).toEqual({ success: true, token: 'mock-jwt-token', mustChangePassword: false })
  })

  it('returns { success: false, error: "INVALID_CREDENTIALS" } when findByEmail returns null', async () => {
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      findByEmail: jest.fn().mockResolvedValue(null),
    })
    const service = new AuthService(client, repo)

    const result = await service.login('nobody@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'INVALID_CREDENTIALS' })
    expect(client.createToken).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "INVALID_CREDENTIALS" } when password does not match', async () => {
    mockCompare.mockResolvedValueOnce(false)
    const client = makeAuthClient()
    const repo = makeUsersRepository()
    const service = new AuthService(client, repo)

    const result = await service.login('player@example.com', 'wrongpassword')

    expect(result).toEqual({ success: false, error: 'INVALID_CREDENTIALS' })
    expect(client.createToken).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when findByEmail throws', async () => {
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      findByEmail: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new AuthService(client, repo)

    const result = await service.login('player@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when createToken throws', async () => {
    mockCompare.mockResolvedValueOnce(true)
    const client = makeAuthClient({
      createToken: jest.fn().mockRejectedValue(new Error('JWT signing error')),
    })
    const repo = makeUsersRepository()
    const service = new AuthService(client, repo)

    const result = await service.login('player@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// AuthService.changePassword
// ---------------------------------------------------------------------------

describe('AuthService.changePassword', () => {
  it('returns { success: true, token } when all steps succeed', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$newhash')
    const client = makeAuthClient()
    const repo = makeUsersRepository()
    const service = new AuthService(client, repo)

    const result = await service.changePassword('user-uuid', 'NewPassword1')

    expect(result).toEqual({ success: true, token: 'mock-jwt-token' })
    expect(repo.setPasswordHash).toHaveBeenCalledWith('user-uuid', '$2b$12$newhash')
    expect(repo.setMustChangePassword).toHaveBeenCalledWith('user-uuid', false)
    expect(client.createToken).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: false }))
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when setPasswordHash throws', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$newhash')
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      setPasswordHash: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new AuthService(client, repo)

    const result = await service.changePassword('user-uuid', 'NewPassword1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(repo.setMustChangePassword).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "FLAG_UPDATE_FAILED" } when setMustChangePassword throws after successful setPasswordHash', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$newhash')
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      setMustChangePassword: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new AuthService(client, repo)

    const result = await service.changePassword('user-uuid', 'NewPassword1')

    expect(result).toEqual({ success: false, error: 'FLAG_UPDATE_FAILED' })
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when findById returns null after updating', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$newhash')
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      findById: jest.fn().mockResolvedValue(null),
    })
    const service = new AuthService(client, repo)

    const result = await service.changePassword('user-uuid', 'NewPassword1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when createToken throws', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$newhash')
    const client = makeAuthClient({
      createToken: jest.fn().mockRejectedValue(new Error('JWT error')),
    })
    const repo = makeUsersRepository()
    const service = new AuthService(client, repo)

    const result = await service.changePassword('user-uuid', 'NewPassword1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// AuthService.createFirstAdmin
// ---------------------------------------------------------------------------

describe('AuthService.createFirstAdmin', () => {
  it('returns { success: true, token } on the happy path', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$hashedpassword')
    const adminRow = makeUserRow({ role: 'admin', mustChangePassword: true })
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      hasAnyUser: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(adminRow),
    })
    const service = new AuthService(client, repo)

    const result = await service.createFirstAdmin('admin@example.com', 'Password1')

    expect(result).toEqual({ success: true, token: 'mock-jwt-token' })
    expect(repo.hasAnyUser).toHaveBeenCalledTimes(1)
    expect(mockHash).toHaveBeenCalledWith('Password1', 12)
    expect(repo.create).toHaveBeenCalledWith({
      email: 'admin@example.com',
      passwordHash: '$2b$12$hashedpassword',
      role: 'admin',
      mustChangePassword: true,
    })
    expect(client.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: true, role: 'admin' }),
    )
  })

  it('returns { success: false, error: "SETUP_ALREADY_COMPLETE" } when hasAnyUser returns true', async () => {
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      hasAnyUser: jest.fn().mockResolvedValue(true),
    })
    const service = new AuthService(client, repo)

    const result = await service.createFirstAdmin('admin@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'SETUP_ALREADY_COMPLETE' })
    expect(repo.create).not.toHaveBeenCalled()
    expect(client.createToken).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when hasAnyUser throws', async () => {
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      hasAnyUser: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new AuthService(client, repo)

    const result = await service.createFirstAdmin('admin@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when create throws', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$hashedpassword')
    const client = makeAuthClient()
    const repo = makeUsersRepository({
      hasAnyUser: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockRejectedValue(new Error('unique constraint')),
    })
    const service = new AuthService(client, repo)

    const result = await service.createFirstAdmin('admin@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(client.createToken).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "UNKNOWN_ERROR" } when createToken throws', async () => {
    mockHash.mockResolvedValueOnce('$2b$12$hashedpassword')
    const adminRow = makeUserRow({ role: 'admin', mustChangePassword: true })
    const client = makeAuthClient({
      createToken: jest.fn().mockRejectedValue(new Error('JWT signing failed')),
    })
    const repo = makeUsersRepository({
      hasAnyUser: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(adminRow),
    })
    const service = new AuthService(client, repo)

    const result = await service.createFirstAdmin('admin@example.com', 'Password1')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})
