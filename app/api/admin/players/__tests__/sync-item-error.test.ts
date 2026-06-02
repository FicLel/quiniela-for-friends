/**
 * Tests for POST /api/admin/players/sync/item-error
 */

// ---------------------------------------------------------------------------
// Mock AuthClient
// ---------------------------------------------------------------------------

const mockGetTokenFromServerAction = jest.fn()
const mockVerifyToken = jest.fn()

jest.mock('@/auth/AuthClient', () => ({
  AuthClient: jest.fn().mockImplementation(() => ({
    getTokenFromServerAction: mockGetTokenFromServerAction,
    verifyToken: mockVerifyToken,
  })),
}))

// ---------------------------------------------------------------------------
// Mock PlayersRepository
// ---------------------------------------------------------------------------

const mockCreateSyncRunItem = jest.fn()

jest.mock('@/players/PlayersRepository', () => ({
  PlayersRepository: jest.fn().mockImplementation(() => ({
    createSyncRunItem: mockCreateSyncRunItem,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '../sync/item-error/route'

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

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/players/sync/item-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  syncRunId: 'sync-run-uuid-1',
  teamExternalId: 762,
  errorMessage: 'Team not found',
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/players/sync/item-error', () => {
  it('returns 403 when not authenticated', async () => {
    makeUnauthAuth()

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 400 INVALID_PAYLOAD when body is not valid JSON', async () => {
    makeAdminAuth()

    const request = new Request('http://localhost/api/admin/players/sync/item-error', {
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

    const response = await POST(makeRequest({ ...VALID_BODY, syncRunId: '' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when teamExternalId is not an integer', async () => {
    makeAdminAuth()

    const response = await POST(makeRequest({ ...VALID_BODY, teamExternalId: 'abc' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when errorMessage is empty', async () => {
    makeAdminAuth()

    const response = await POST(makeRequest({ ...VALID_BODY, errorMessage: '' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 200 success on valid request', async () => {
    makeAdminAuth()
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it('calls createSyncRunItem with correct error item fields', async () => {
    makeAdminAuth()
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    await POST(makeRequest(VALID_BODY))

    expect(mockCreateSyncRunItem).toHaveBeenCalledWith({
      syncRunId: 'sync-run-uuid-1',
      teamExternalId: 762,
      status: 'error',
      errorMessage: 'Team not found',
    })
  })

  it('returns 500 DB_ERROR when createSyncRunItem throws', async () => {
    makeAdminAuth()
    mockCreateSyncRunItem.mockRejectedValue(new Error('insert failed'))

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns 403 when session role is player (not admin)', async () => {
    mockGetTokenFromServerAction.mockResolvedValue('mock-token')
    mockVerifyToken.mockResolvedValue({ ...ADMIN_SESSION, role: 'player' })

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })
})
