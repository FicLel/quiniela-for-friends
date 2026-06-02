/**
 * Tests for POST /api/admin/players/save-team
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

const mockUpsertPlayers = jest.fn()
const mockCreateSyncRunItem = jest.fn()

jest.mock('@/players/PlayersRepository', () => ({
  PlayersRepository: jest.fn().mockImplementation(() => ({
    upsertPlayers: mockUpsertPlayers,
    createSyncRunItem: mockCreateSyncRunItem,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '../save-team/route'

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
  return new Request('http://localhost/api/admin/players/save-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  syncRunId: 'sync-run-uuid-1',
  teamExternalId: 759,
  players: [
    {
      providerPlayerId: 1001,
      teamExternalId: 759,
      name: 'Manuel Neuer',
      position: 'Goalkeeper',
      shirtNumber: 1,
    },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/players/save-team', () => {
  it('returns 403 when not authenticated', async () => {
    makeUnauthAuth()

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 400 INVALID_PAYLOAD when body is not valid JSON', async () => {
    makeAdminAuth()

    const request = new Request('http://localhost/api/admin/players/save-team', {
      method: 'POST',
      body: 'not-json',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when syncRunId is missing', async () => {
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

  it('returns 400 INVALID_PAYLOAD when players is not an array', async () => {
    makeAdminAuth()

    const response = await POST(makeRequest({ ...VALID_BODY, players: 'not-array' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 400 INVALID_PAYLOAD when a player row has invalid fields', async () => {
    makeAdminAuth()

    const response = await POST(
      makeRequest({
        ...VALID_BODY,
        players: [{ providerPlayerId: 'not-number', teamExternalId: 759, name: 'X', position: null, shirtNumber: null }],
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'INVALID_PAYLOAD' })
  })

  it('returns 200 with playersUpserted count on success', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockResolvedValue(1)
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, playersUpserted: 1 })
  })

  it('calls upsertPlayers with the players array from the body', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockResolvedValue(1)
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    await POST(makeRequest(VALID_BODY))

    expect(mockUpsertPlayers).toHaveBeenCalledWith(VALID_BODY.players)
  })

  it('records a success sync_run_item with correct fields', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockResolvedValue(1)
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    await POST(makeRequest(VALID_BODY))

    expect(mockCreateSyncRunItem).toHaveBeenCalledWith({
      syncRunId: 'sync-run-uuid-1',
      teamExternalId: 759,
      status: 'success',
      playersUpserted: 1,
    })
  })

  it('accepts an empty players array', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockResolvedValue(0)
    mockCreateSyncRunItem.mockResolvedValue(undefined)

    const response = await POST(makeRequest({ ...VALID_BODY, players: [] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, playersUpserted: 0 })
  })

  it('returns 500 DB_ERROR when upsertPlayers throws', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockRejectedValue(new Error('DB connection failed'))

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns 500 DB_ERROR when createSyncRunItem throws', async () => {
    makeAdminAuth()
    mockUpsertPlayers.mockResolvedValue(1)
    mockCreateSyncRunItem.mockRejectedValue(new Error('insert failed'))

    const response = await POST(makeRequest(VALID_BODY))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })
})
