/**
 * Tests for GET /api/admin/settings and PUT /api/admin/settings.
 *
 * Matches patterns used in app/api/admin/players/__tests__/sync-start.test.ts
 * and save-team.test.ts.
 */

// ---------------------------------------------------------------------------
// Mock AuthClient
// ---------------------------------------------------------------------------

const mockGetTokenFromServerAction = jest.fn()
const mockVerifyToken = jest.fn()

const mockRequireWritableSession = jest.fn()

jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    getTokenFromServerAction: mockGetTokenFromServerAction,
    verifyToken: mockVerifyToken,
    requireWritableSession: mockRequireWritableSession,
  })),
}))

// ---------------------------------------------------------------------------
// Mock AppSettingsService
// ---------------------------------------------------------------------------

const mockGetSettings = jest.fn()
const mockSetPredictionMode = jest.fn()

jest.mock('@/appSettings/AppSettingsService', () => ({
  AppSettingsService: jest.fn().mockImplementation(() => ({
    getSettings: mockGetSettings,
    setPredictionMode: mockSetPredictionMode,
  })),
}))

// Mock the repository to prevent real Supabase client construction
jest.mock('@/appSettings/AppSettingsRepository', () => ({
  AppSettingsRepository: jest.fn().mockImplementation(() => ({})),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET, PUT } from '../route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  sub: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin' as const,
  mustChangePassword: false,
  tokenVersion: 1,
}

const PLAYER_SESSION = {
  ...ADMIN_SESSION,
  role: 'player' as const,
}

const IMPERSONATING_ADMIN_SESSION = {
  ...ADMIN_SESSION,
  impersonating: { userId: 'player-user-id', email: 'player@example.com' },
}

function makeAdminRequest() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(ADMIN_SESSION)
}

function makePlayerRequest() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(PLAYER_SESSION)
}

function makeUnauthRequest() {
  mockGetTokenFromServerAction.mockResolvedValue(null)
  mockVerifyToken.mockResolvedValue(null)
}

function makeImpersonatingAdminRequest() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(IMPERSONATING_ADMIN_SESSION)
}

function makePutRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeMalformedRequest(): Request {
  return new Request('http://localhost/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-valid-json{{{',
  })
}

const APP_SETTINGS = {
  id: 'settings-uuid',
  predictionMode: 'shared' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWritableSession.mockReturnValue({ allowed: true })
})

// ---------------------------------------------------------------------------
// GET /api/admin/settings
// ---------------------------------------------------------------------------

describe('GET /api/admin/settings', () => {
  it('returns 200 with settings when the caller is admin', async () => {
    makeAdminRequest()
    mockGetSettings.mockResolvedValueOnce({ success: true, settings: APP_SETTINGS })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      settings: { predictionMode: 'shared' },
    })
  })

  it('returns 403 UNAUTHORIZED when the caller is not admin (player)', async () => {
    makePlayerRequest()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockGetSettings).not.toHaveBeenCalled()
  })

  it('returns 403 UNAUTHORIZED when there is no session', async () => {
    makeUnauthRequest()

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 500 NOT_FOUND when the settings row does not exist', async () => {
    makeAdminRequest()
    mockGetSettings.mockResolvedValueOnce({ success: false, error: 'NOT_FOUND' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'NOT_FOUND' })
  })

  it('returns 500 UNKNOWN_ERROR when the service throws an unknown error', async () => {
    makeAdminRequest()
    mockGetSettings.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// PUT /api/admin/settings
// ---------------------------------------------------------------------------

describe('PUT /api/admin/settings', () => {
  it('returns 200 success when admin updates predictionMode to per_quiniela', async () => {
    makeAdminRequest()
    mockSetPredictionMode.mockResolvedValueOnce({ success: true })

    const response = await PUT(makePutRequest({ predictionMode: 'per_quiniela' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockSetPredictionMode).toHaveBeenCalledWith('per_quiniela')
  })

  it('returns 200 success when admin updates predictionMode to shared', async () => {
    makeAdminRequest()
    mockSetPredictionMode.mockResolvedValueOnce({ success: true })

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockSetPredictionMode).toHaveBeenCalledWith('shared')
  })

  it('returns 400 INVALID_PAYLOAD when predictionMode is an unrecognized value', async () => {
    makeAdminRequest()

    const response = await PUT(makePutRequest({ predictionMode: 'invalid_mode' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
    expect(mockSetPredictionMode).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_PAYLOAD when the body is missing predictionMode', async () => {
    makeAdminRequest()

    const response = await PUT(makePutRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when the body is not a JSON object', async () => {
    makeAdminRequest()

    const response = await PUT(makePutRequest('just a string'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when the request body is malformed JSON', async () => {
    makeAdminRequest()

    const response = await PUT(makeMalformedRequest())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 403 UNAUTHORIZED when the caller is not admin (player)', async () => {
    makePlayerRequest()

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockSetPredictionMode).not.toHaveBeenCalled()
  })

  it('returns 403 UNAUTHORIZED when there is no session', async () => {
    makeUnauthRequest()

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 500 DB_ERROR when the service returns DB_ERROR', async () => {
    makeAdminRequest()
    mockSetPredictionMode.mockResolvedValueOnce({ success: false, error: 'DB_ERROR' })

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns 500 UNKNOWN_ERROR when the service returns UNKNOWN_ERROR', async () => {
    makeAdminRequest()
    mockSetPredictionMode.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns 403 IMPERSONATING_READ_ONLY when the caller is an admin impersonating another user', async () => {
    makeImpersonatingAdminRequest()
    mockRequireWritableSession.mockReturnValue({ allowed: false, error: 'IMPERSONATING_READ_ONLY' })

    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'IMPERSONATING_READ_ONLY' })
    expect(mockSetPredictionMode).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_MODE (mapped from service) when service returns INVALID_MODE', async () => {
    // This path is unusual since we validate before calling service, but guard is still there
    makeAdminRequest()
    mockSetPredictionMode.mockResolvedValueOnce({ success: false, error: 'INVALID_MODE' })

    // Force an invalid mode through by mocking; in practice the route validates before calling
    // We need to bypass the route validation to trigger this branch —
    // we do so by making the request with a valid value that the service rejects
    const response = await PUT(makePutRequest({ predictionMode: 'shared' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_MODE' })
  })
})
