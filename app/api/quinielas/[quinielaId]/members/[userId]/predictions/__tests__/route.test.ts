/**
 * Tests for GET /api/quinielas/[quinielaId]/members/[userId]/predictions
 *
 * AuthClient and MembershipsRepository are mocked at the module level.
 * LeaderboardService is mocked to prevent real Supabase client construction.
 *
 * Access control rules:
 *  - Any approved member of the quiniela may view any member's predictions.
 *  - The target userId (route param) does NOT need to match the session user.
 *  - No session → 403
 *  - Valid session but not approved member → 403
 *  - Approved member → 200 with predictions array
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
    getEffectiveUserId: (session: { sub: string; impersonating?: { userId: string } } | null) =>
      session?.impersonating?.userId ?? session?.sub,
  })),
}))

// ---------------------------------------------------------------------------
// Mock MembershipsRepository
// ---------------------------------------------------------------------------

const mockIsApprovedMember = jest.fn()

jest.mock('@/memberships/MembershipsRepository', () => ({
  MembershipsRepository: jest.fn().mockImplementation(() => ({
    isApprovedMember: mockIsApprovedMember,
  })),
}))

// ---------------------------------------------------------------------------
// Mock LeaderboardService
// ---------------------------------------------------------------------------

const mockGetPlayerPredictions = jest.fn()

jest.mock('@/scoring/LeaderboardService', () => ({
  LeaderboardService: jest.fn().mockImplementation(() => ({
    getPlayerPredictions: mockGetPlayerPredictions,
  })),
}))

// Mock repositories to prevent real Supabase client construction
jest.mock('@/scoring/PredictionScoreRepository', () => ({
  PredictionScoreRepository: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/users/UsersRepository', () => ({
  UsersRepository: jest.fn().mockImplementation(() => ({})),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET } from '../route'
import type { PlayerPredictionEntry } from '@/scoring/scoring.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  sub: 'caller-user-id',
  email: 'caller@example.com',
  role: 'player' as const,
  mustChangePassword: false,
  tokenVersion: 1,
}

const ADMIN_IMPERSONATING_SESSION = {
  sub: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin' as const,
  mustChangePassword: false,
  tokenVersion: 1,
  impersonating: { userId: 'target-user-id', email: 'target@example.com' },
}

const QUINIELA_ID = 'quiniela-uuid'
const TARGET_USER_ID = 'target-user-id'

const PREDICTION: PlayerPredictionEntry = {
  matchId: 'match-uuid-1',
  homeTeamName: 'Germany',
  awayTeamName: 'Scotland',
  scheduledAt: '2026-06-14T16:00:00Z',
  predictedHomeScore: 2,
  predictedAwayScore: 1,
  regulationHomeGoals: 2,
  regulationAwayGoals: 1,
  homeGoalPoint: 1,
  awayGoalPoint: 1,
  outcomePoint: 1,
  totalPoints: 3,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(quinielaId = QUINIELA_ID, userId = TARGET_USER_ID): Request {
  return new Request(
    `http://localhost/api/quinielas/${quinielaId}/members/${userId}/predictions`,
    { method: 'GET' },
  )
}

function makeParams(quinielaId = QUINIELA_ID, userId = TARGET_USER_ID) {
  return { params: Promise.resolve({ quinielaId, userId }) }
}

function setupAuth(session: typeof SESSION | typeof ADMIN_IMPERSONATING_SESSION | null) {
  mockGetTokenFromServerAction.mockResolvedValue(session ? 'mock-token' : null)
  mockVerifyToken.mockResolvedValue(session)
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/quinielas/[quinielaId]/members/[userId]/predictions', () => {
  it('returns 200 with predictions when caller is an approved member', async () => {
    setupAuth(SESSION)
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([PREDICTION])

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, predictions: [PREDICTION] })
    expect(mockIsApprovedMember).toHaveBeenCalledWith(QUINIELA_ID, SESSION.sub)
    expect(mockGetPlayerPredictions).toHaveBeenCalledWith(QUINIELA_ID, TARGET_USER_ID, { isImpersonating: false })
  })

  it('returns 200 when caller views their own predictions (userId === session.sub)', async () => {
    setupAuth({ ...SESSION, sub: TARGET_USER_ID })
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([PREDICTION])

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 200 when caller views another member (userId !== session.sub)', async () => {
    // caller is 'caller-user-id', target is 'other-user-id'
    setupAuth(SESSION) // session.sub = 'caller-user-id'
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([PREDICTION])

    const response = await GET(makeRequest(QUINIELA_ID, 'other-user-id'), makeParams(QUINIELA_ID, 'other-user-id'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    // isApprovedMember is called with caller's userId, not target's
    expect(mockIsApprovedMember).toHaveBeenCalledWith(QUINIELA_ID, SESSION.sub)
    expect(mockGetPlayerPredictions).toHaveBeenCalledWith(QUINIELA_ID, 'other-user-id', { isImpersonating: false })
  })

  it('returns 200 with empty predictions array when no predictions exist', async () => {
    setupAuth(SESSION)
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([])

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, predictions: [] })
  })

  it('returns 403 UNAUTHORIZED when there is no session', async () => {
    setupAuth(null)

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockIsApprovedMember).not.toHaveBeenCalled()
    expect(mockGetPlayerPredictions).not.toHaveBeenCalled()
  })

  it('returns 403 UNAUTHORIZED when the caller is not an approved member', async () => {
    setupAuth(SESSION)
    mockIsApprovedMember.mockResolvedValue(false)

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(mockGetPlayerPredictions).not.toHaveBeenCalled()
  })

  it('returns 500 UNKNOWN_ERROR when the repository throws', async () => {
    setupAuth(SESSION)
    mockIsApprovedMember.mockRejectedValue(new Error('DB connection failed'))

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('returns 500 UNKNOWN_ERROR when getPlayerPredictions throws', async () => {
    setupAuth(SESSION)
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockRejectedValue(new Error('findPlayerPredictionsForViewer failed: DB error'))

    const response = await GET(makeRequest(), makeParams())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })

  it('passes isImpersonating: true when an admin views the impersonated user\'s own predictions', async () => {
    // session.impersonating.userId === route param userId === effectiveUserId
    setupAuth(ADMIN_IMPERSONATING_SESSION)
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([PREDICTION])

    const response = await GET(
      makeRequest(QUINIELA_ID, ADMIN_IMPERSONATING_SESSION.impersonating.userId),
      makeParams(QUINIELA_ID, ADMIN_IMPERSONATING_SESSION.impersonating.userId),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, predictions: [PREDICTION] })
    // isApprovedMember is checked against the effective (impersonated) user
    expect(mockIsApprovedMember).toHaveBeenCalledWith(QUINIELA_ID, ADMIN_IMPERSONATING_SESSION.impersonating.userId)
    expect(mockGetPlayerPredictions).toHaveBeenCalledWith(
      QUINIELA_ID,
      ADMIN_IMPERSONATING_SESSION.impersonating.userId,
      { isImpersonating: true },
    )
  })

  it('passes isImpersonating: false when an impersonating admin views a different member\'s predictions', async () => {
    // route param userId !== effectiveUserId (admin viewing someone else while impersonating)
    setupAuth(ADMIN_IMPERSONATING_SESSION)
    mockIsApprovedMember.mockResolvedValue(true)
    mockGetPlayerPredictions.mockResolvedValue([PREDICTION])

    const response = await GET(makeRequest(QUINIELA_ID, 'some-other-user-id'), makeParams(QUINIELA_ID, 'some-other-user-id'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetPlayerPredictions).toHaveBeenCalledWith(QUINIELA_ID, 'some-other-user-id', { isImpersonating: false })
  })
})
