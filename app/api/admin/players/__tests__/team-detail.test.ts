/**
 * Tests for GET /api/admin/players/team-detail?teamId={teamId}
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
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET } from '../team-detail/route'

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

function makeRequest(url: string) {
  return new Request(url)
}

function makeAdminAuth() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(ADMIN_SESSION)
}

function makeUnauthAuth() {
  mockGetTokenFromServerAction.mockResolvedValue(null)
  mockVerifyToken.mockResolvedValue(null)
}

const SQUAD_RESPONSE = {
  id: 759,
  name: 'Germany',
  squad: [
    { id: 1001, name: 'Manuel Neuer', position: 'Goalkeeper', shirtNumber: 1 },
    { id: 1002, name: 'Thomas Müller', position: 'Midfielder', shirtNumber: 25 },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FOOTBALL_DATA_ORG_API_KEY = 'test-api-key'
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/players/team-detail', () => {
  it('returns 403 when not authenticated', async () => {
    makeUnauthAuth()

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 400 MISSING_PARAM when teamId query param is absent', async () => {
    makeAdminAuth()

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'MISSING_PARAM' })
  })

  it('returns 400 MISSING_PARAM when teamId is not numeric', async () => {
    makeAdminAuth()

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=abc'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'MISSING_PARAM' })
  })

  it('returns 200 with squad data on success', async () => {
    makeAdminAuth()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => SQUAD_RESPONSE,
    })

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      squad: SQUAD_RESPONSE.squad,
    })
  })

  it('calls football-data.org with the correct URL and auth header', async () => {
    makeAdminAuth()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => SQUAD_RESPONSE,
    })

    await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.football-data.org/v4/teams/759',
      { headers: { 'X-Auth-Token': 'test-api-key' } },
    )
  })

  it('does NOT include the API key in the response body', async () => {
    makeAdminAuth()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => SQUAD_RESPONSE,
    })

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const text = await response.text()

    expect(text).not.toContain('test-api-key')
    expect(text).not.toContain('X-Auth-Token')
  })

  it('returns 502 FETCH_FAILED when upstream returns non-2xx', async () => {
    makeAdminAuth()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ success: false, error: 'FETCH_FAILED' })
  })

  it('returns 502 FETCH_FAILED when fetch throws a network error', async () => {
    makeAdminAuth()
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ success: false, error: 'FETCH_FAILED' })
  })

  it('returns empty squad array when API response has no squad field', async () => {
    makeAdminAuth()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 759, name: 'Germany' }), // no squad field
    })

    const response = await GET(makeRequest('http://localhost/api/admin/players/team-detail?teamId=759'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, squad: [] })
  })
})
