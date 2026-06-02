/**
 * Tests for POST /api/admin/players/sync/start
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

const mockGetActiveSync = jest.fn()
const mockCreateSyncRun = jest.fn()
const mockGetDistinctTeamExternalIds = jest.fn()
const mockUpdateSyncRun = jest.fn()

jest.mock('@/players/PlayersRepository', () => ({
  PlayersRepository: jest.fn().mockImplementation(() => ({
    getActiveSync: mockGetActiveSync,
    createSyncRun: mockCreateSyncRun,
    getDistinctTeamExternalIds: mockGetDistinctTeamExternalIds,
    updateSyncRun: mockUpdateSyncRun,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from '../sync/start/route'

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

function makeAdminRequest() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue(ADMIN_SESSION)
}

function makeUnauthRequest() {
  mockGetTokenFromServerAction.mockResolvedValue(null)
  mockVerifyToken.mockResolvedValue(null)
}

function makePlayerRequest() {
  mockGetTokenFromServerAction.mockResolvedValue('mock-token')
  mockVerifyToken.mockResolvedValue({ ...ADMIN_SESSION, role: 'player' })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/players/sync/start', () => {
  it('returns 403 when no token is present', async () => {
    makeUnauthRequest()

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 403 when the session role is player (not admin)', async () => {
    makePlayerRequest()

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns 409 when an active sync run already exists', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockResolvedValue({
      id: 'sync-run-uuid-1',
      status: 'in_progress',
      startedAt: new Date(),
      finishedAt: null,
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({ success: false, error: 'SYNC_IN_PROGRESS' })
    expect(mockCreateSyncRun).not.toHaveBeenCalled()
  })

  it('returns 200 with syncRunId and teamIds on success', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockResolvedValue(null)
    mockCreateSyncRun.mockResolvedValue({
      id: 'new-sync-run-uuid',
      status: 'in_progress',
      startedAt: new Date(),
      finishedAt: null,
    })
    mockGetDistinctTeamExternalIds.mockResolvedValue([759, 762, 770])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      syncRunId: 'new-sync-run-uuid',
      teamIds: [759, 762, 770],
    })
  })

  it('returns 200 with empty teamIds when no matches exist', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockResolvedValue(null)
    mockCreateSyncRun.mockResolvedValue({
      id: 'new-sync-run-uuid',
      status: 'in_progress',
      startedAt: new Date(),
      finishedAt: null,
    })
    mockGetDistinctTeamExternalIds.mockResolvedValue([])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.teamIds).toEqual([])
  })

  it('returns 500 DB_ERROR when repository throws', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockRejectedValue(new Error('DB connection failed'))

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns 500 DB_ERROR when createSyncRun throws', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockResolvedValue(null)
    mockCreateSyncRun.mockRejectedValue(new Error('insert failed'))

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('marks sync_run as failed and returns 500 when getDistinctTeamExternalIds throws after createSyncRun', async () => {
    makeAdminRequest()
    mockGetActiveSync.mockResolvedValue(null)
    mockCreateSyncRun.mockResolvedValue({
      id: 'new-sync-run-uuid',
      status: 'in_progress',
      startedAt: new Date(),
      finishedAt: null,
    })
    mockGetDistinctTeamExternalIds.mockRejectedValue(new Error('RPC failed'))
    mockUpdateSyncRun.mockResolvedValue(undefined)

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'DB_ERROR' })
    expect(mockUpdateSyncRun).toHaveBeenCalledWith(
      'new-sync-run-uuid',
      'failed',
      expect.any(Date),
    )
  })
})
