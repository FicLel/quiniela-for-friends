import type { CreateFirstAdminResult } from '@/auth/auth.types'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that trigger module evaluation.
// ---------------------------------------------------------------------------

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

const mockSetSessionCookieOnServerAction = jest.fn<Promise<void>, [string]>()
jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    setSessionCookieOnServerAction: mockSetSessionCookieOnServerAction,
  })),
}))

const mockUsersRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  setMustChangePassword: jest.fn(),
  setPasswordHash: jest.fn(),
  create: jest.fn(),
  hasAnyUser: jest.fn(),
}
jest.mock('@/users/UsersRepository', () => ({
  UsersRepository: jest.fn().mockImplementation(() => mockUsersRepository),
}))

const mockCreateFirstAdmin = jest.fn<Promise<CreateFirstAdminResult>, [string, string]>()
jest.mock('@/auth/AuthService', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    login: jest.fn(),
    changePassword: jest.fn(),
    createFirstAdmin: mockCreateFirstAdmin,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up.
// ---------------------------------------------------------------------------
import { createFirstAdmin } from '../actions'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createFirstAdmin server action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetSessionCookieOnServerAction.mockResolvedValue(undefined)
  })

  it('returns UNKNOWN_ERROR when email is invalid', async () => {
    const result = await createFirstAdmin('es', 'not-an-email', 'Password1!', 'Password1!')
    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('returns UNKNOWN_ERROR when password is too short', async () => {
    const result = await createFirstAdmin('es', 'admin@example.com', 'short', 'short')
    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('returns UNKNOWN_ERROR when passwords do not match', async () => {
    const result = await createFirstAdmin('es', 'admin@example.com', 'Password1!', 'Password2!')
    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('propagates SETUP_ALREADY_COMPLETE from AuthService', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: false, error: 'SETUP_ALREADY_COMPLETE' })

    const result = await createFirstAdmin('es', 'admin@example.com', 'Password1!', 'Password1!')
    expect(result).toEqual({ success: false, error: 'SETUP_ALREADY_COMPLETE' })
    expect(mockSetSessionCookieOnServerAction).not.toHaveBeenCalled()
  })

  it('propagates UNKNOWN_ERROR from AuthService', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    const result = await createFirstAdmin('es', 'admin@example.com', 'Password1!', 'Password1!')
    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
    expect(mockSetSessionCookieOnServerAction).not.toHaveBeenCalled()
  })

  it('sets session cookie and redirects to /es/auth/change-password on success', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: true, token: 'jwt-token' })

    await expect(
      createFirstAdmin('es', 'admin@example.com', 'Password1!', 'Password1!'),
    ).rejects.toThrow('NEXT_REDIRECT:/es/auth/change-password')

    expect(mockSetSessionCookieOnServerAction).toHaveBeenCalledWith('jwt-token')
    expect(mockRedirect).toHaveBeenCalledWith('/es/auth/change-password')
  })

  it('normalises email to lowercase before calling AuthService', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    await createFirstAdmin('es', 'ADMIN@EXAMPLE.COM', 'Password1!', 'Password1!')

    expect(mockCreateFirstAdmin).toHaveBeenCalledWith(
      'admin@example.com',
      'Password1!',
    )
  })
})
