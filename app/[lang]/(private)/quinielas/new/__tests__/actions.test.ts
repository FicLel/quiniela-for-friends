/**
 * Tests for createQuiniela server action.
 *
 * These are unit tests that mock the auth layer and service layer to verify
 * the action's validation and delegation logic.
 */

// Mock next/navigation redirect to prevent it from throwing in tests
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock AuthClient
const mockRequireWritableSession = jest.fn().mockReturnValue({ allowed: true })
jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    getTokenFromServerAction: jest.fn().mockResolvedValue('mock-token'),
    verifyToken: jest.fn().mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'player',
      mustChangePassword: false,
    }),
    requireWritableSession: mockRequireWritableSession,
  })),
}))

// Mock QuinielasService
const mockCreateQuiniela = jest.fn()
jest.mock('@/quinielas/QuinielasService', () => ({
  QuinielasService: jest.fn().mockImplementation(() => ({
    createQuiniela: mockCreateQuiniela,
  })),
}))

// Mock QuinielasRepository
jest.mock('@/quinielas/QuinielasRepository', () => ({
  QuinielasRepository: jest.fn().mockImplementation(() => ({})),
}))

import { createQuiniela } from '../actions'
import { redirect } from 'next/navigation'

describe('createQuiniela action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireWritableSession.mockReturnValue({ allowed: true })
  })

  it('returns IMPERSONATING_READ_ONLY when the session is impersonating', async () => {
    mockRequireWritableSession.mockReturnValue({ allowed: false, error: 'IMPERSONATING_READ_ONLY' })

    const result = await createQuiniela('en', 'My Quiniela')

    expect(result).toEqual({ success: false, error: 'IMPERSONATING_READ_ONLY' })
    expect(mockCreateQuiniela).not.toHaveBeenCalled()
  })

  it('returns NAME_EMPTY for a blank name', async () => {
    const result = await createQuiniela('en', '')
    expect(result).toEqual({ success: false, error: 'NAME_EMPTY' })
    expect(mockCreateQuiniela).not.toHaveBeenCalled()
  })

  it('returns NAME_EMPTY for whitespace-only name', async () => {
    const result = await createQuiniela('en', '   ')
    expect(result).toEqual({ success: false, error: 'NAME_EMPTY' })
    expect(mockCreateQuiniela).not.toHaveBeenCalled()
  })

  it('calls service with trimmed name and callerUserId on success', async () => {
    mockCreateQuiniela.mockResolvedValue({
      success: true,
      quiniela: { id: 'qid-1', name: 'World Cup 2026', createdAt: new Date(), updatedAt: new Date() },
    })

    await createQuiniela('en', '  World Cup 2026  ')

    expect(mockCreateQuiniela).toHaveBeenCalledWith({
      name: 'World Cup 2026',
      userId: 'user-123',
    })
  })

  it('redirects to members page on success', async () => {
    mockCreateQuiniela.mockResolvedValue({
      success: true,
      quiniela: { id: 'qid-1', name: 'My Quiniela', createdAt: new Date(), updatedAt: new Date() },
    })

    await createQuiniela('en', 'My Quiniela')

    expect(redirect).toHaveBeenCalledWith('/en/quinielas/qid-1/members')
  })

  it('returns DB_ERROR when service returns DB_ERROR', async () => {
    mockCreateQuiniela.mockResolvedValue({ success: false, error: 'DB_ERROR' })

    const result = await createQuiniela('en', 'My Quiniela')
    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns UNKNOWN_ERROR when service returns UNKNOWN_ERROR', async () => {
    mockCreateQuiniela.mockResolvedValue({ success: false, error: 'UNKNOWN_ERROR' })

    const result = await createQuiniela('en', 'My Quiniela')
    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('accepts name up to 100 characters', async () => {
    const longName = 'a'.repeat(100)
    mockCreateQuiniela.mockResolvedValue({
      success: true,
      quiniela: { id: 'qid-1', name: longName, createdAt: new Date(), updatedAt: new Date() },
    })

    await createQuiniela('en', longName)
    expect(mockCreateQuiniela).toHaveBeenCalledWith({ name: longName, userId: 'user-123' })
  })

  it('returns NAME_EMPTY for name exceeding 100 characters', async () => {
    const tooLongName = 'a'.repeat(101)
    const result = await createQuiniela('en', tooLongName)
    expect(result).toEqual({ success: false, error: 'NAME_EMPTY' })
  })
})
