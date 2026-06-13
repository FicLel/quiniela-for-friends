/**
 * Tests for POST /api/admin/players/sync/finish
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
// Mock PlayersRepository
// ---------------------------------------------------------------------------

const mockUpdateSyncRun = jest.fn()

jest.mock('@/players/PlayersRepository', () => ({
  PlayersRepository: jest.fn().mockImplementation(() => ({
    updateSyncRun: mockUpdateSyncRun,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '../sync/finish/route'

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

function makeAdminAuth() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(ADMIN_SESSION)
}

function makeUnauthAuth() {
  mockGetTokenFromServerAction.mockResolvedValue(null)
  mockVerifyToken.mockResolvedValue(null)
}

function makeImpersonatingAdminAuth() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue({
    ...ADMIN_SESSION,
    impersonating: { userId: 'player-user-id', email: 'player@example.com' },
  })
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/players/sync/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_COMPLETED_BODY = { syncRunId: 'sync-run-uuid-1', status: 'completed' }
const VALID_FAILED_BODY = { syncRunId: 'sync-run-uuid-1', status: 'failed' }

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWritableSession.mockReturnValue({ allowed: true })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/players/sync/finish', () => {
  it('returns 403 when not authenticated', async () => {
    makeUnauthAuth()

    const response = await POST(makeRequest(VALID_COMPLETED_BODY))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 403 IMPERSONATING_READ_ONLY when the caller is an admin impersonating another user', async () => {
    makeImpersonatingAdminAuth()
    mockRequireWritableSession.mockReturnValue({ allowed: false, error: 'IMPERSONATING_READ_ONLY' })

    const response = await POST(makeRequest(VALID_COMPLETED_BODY))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'IMPERSONATING_READ_ONLY' })
    expect(mockUpdateSyncRun).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_PAYLOAD when body is not valid JSON', async () => {
    makeAdminAuth()

    const request = new Request('http://localhost/api/admin/players/sync/finish', {
      method: 'POST',
      body: 'not-json',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when syncRunId is empty', async () => {
    makeAdminAuth()

    const response = await POST(makeRequest({ syncRunId: '', status: 'completed' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when status is not completed or failed', async () => {
    makeAdminAuth()

    const response = await POST(makeRequest({ syncRunId: 'sync-run-uuid-1', status: 'in_progress' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 200 success when status is completed', async () => {
    makeAdminAuth()
    mockUpdateSyncRun.mockResolvedValue(undefined)

    const response = await POST(makeRequest(VALID_COMPLETED_BODY))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it('returns 200 success when status is failed', async () => {
    makeAdminAuth()
    mockUpdateSyncRun.mockResolvedValue(undefined)

    const response = await POST(makeRequest(VALID_FAILED_BODY))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it('calls updateSyncRun with correct syncRunId, status, and a Date', async () => {
    makeAdminAuth()
    mockUpdateSyncRun.mockResolvedValue(undefined)

    const before = new Date()
    await POST(makeRequest(VALID_COMPLETED_BODY))
    const after = new Date()

    expect(mockUpdateSyncRun).toHaveBeenCalledTimes(1)
    const [calledId, calledStatus, calledDate] = mockUpdateSyncRun.mock.calls[0] as [string, string, Date]
    expect(calledId).toBe('sync-run-uuid-1')
    expect(calledStatus).toBe('completed')
    expect(calledDate).toBeInstanceOf(Date)
    expect(calledDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100)
    expect(calledDate.getTime()).toBeLessThanOrEqual(after.getTime() + 100)
  })

  it('returns 500 DB_ERROR when updateSyncRun throws', async () => {
    makeAdminAuth()
    mockUpdateSyncRun.mockRejectedValue(new Error('update failed'))

    const response = await POST(makeRequest(VALID_COMPLETED_BODY))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })
})
