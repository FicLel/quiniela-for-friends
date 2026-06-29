/**
 * Unit tests for PredictionScoreRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover:
 *  - findPredictionsWithQuinielas: shared prediction fans out across all approved memberships
 *  - findPredictionsWithQuinielas: per-quiniela prediction yields only its own quiniela_id
 *  - findCrowdOutcomes: aggregates all predictions for a match regardless of quiniela_id
 *  - aggregateByQuiniela: accumulates homeGoalPoints/awayGoalPoints/outcomePoints/extraQuestionPoints
 *  - findPlayerPredictionsForViewer: returns PlayerPredictionEntry[] for FINISHED matches
 *
 * The repository makes two separate Supabase queries (no FK join):
 *   1. from('user_expected_results').select(...).eq('match_id', matchId)
 *   2. from('quiniela_memberships').select(...).in(...).not(...)   [only for shared rows]
 *
 * findCrowdOutcomes:
 *   from('user_expected_results').select('home_score, away_score').eq('match_id', matchId)
 */

import { PredictionScoreRepository, resetPlayerPredictionsCache } from '../PredictionScoreRepository'
import { resetSupabaseServerClient } from '@/lib/supabaseServerClient'
import { resetSchemaCheckCache } from '@/lib/schemaCheckCache'

// ---------------------------------------------------------------------------
// Mock plumbing
// ---------------------------------------------------------------------------

// Schema-check terminator: limit(0) → Promise<{ error }>
const mockSchemaLimit = jest.fn()

// --------------------------------------------------------------------------
// user_expected_results query chain
//
//  findPredictionsWithQuinielas:
//    select('id, user_id, home_score, away_score, quiniela_id').eq('match_id', id)
//
//  findCrowdOutcomes:
//    select('home_score, away_score').eq('match_id', id)
//
//  Both end with .eq('match_id', ...) as the terminal call.
// --------------------------------------------------------------------------
const mockUerEq = jest.fn()  // terminal eq for user_expected_results queries

// --------------------------------------------------------------------------
// quiniela_memberships query chain (for shared predictions fan-out)
//
//   select('user_id, quiniela_id').in('user_id', ids).not('approved_at', 'is', null)
// --------------------------------------------------------------------------
const mockMembershipsNot = jest.fn()  // .not('approved_at', 'is', null) → Promise<{data, error}>
const mockMembershipsIn = jest.fn(() => ({ not: mockMembershipsNot }))

// --------------------------------------------------------------------------
// Schema-check chain: select('id').limit(0)
// --------------------------------------------------------------------------
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  return Promise.resolve({ data: null, error: null })
})

// --------------------------------------------------------------------------
// findCrowdOutcomesByMatchIds chain:
//   select('match_id, home_score, away_score').in('match_id', ids).limit(n) — terminal
// --------------------------------------------------------------------------
const mockUerInLimit = jest.fn()
const mockUerIn = jest.fn(() => ({ limit: mockUerInLimit }))

// --------------------------------------------------------------------------
// Combined select router
// --------------------------------------------------------------------------
const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  if (arg === 'user_id, quiniela_id') {
    // quiniela_memberships: .select('user_id, quiniela_id').in(...)
    return { in: mockMembershipsIn }
  }
  if (arg === 'match_id, home_score, away_score') {
    // findCrowdOutcomesByMatchIds: batched crowd outcomes
    return { in: mockUerIn }
  }
  // user_expected_results data selects: route to mockUerEq terminal
  return { eq: mockUerEq }
})

// --------------------------------------------------------------------------
// aggregateByQuiniela: prediction_scores complex select
//
//   from('prediction_scores')
//     .select(`total_points, home_goal_point, away_goal_point, outcome_point, user_expected_results!inner(user_id)`)
//     .eq('quiniela_id', id)
//
// Terminal call is .eq('quiniela_id', id).
// --------------------------------------------------------------------------
const mockPredictionScoresEq = jest.fn()  // terminal eq for prediction_scores aggregate

// --------------------------------------------------------------------------
// findPlayerPredictionsForViewer: prediction_scores join select
//
//   from('prediction_scores')
//     .select(`home_goal_point, away_goal_point, outcome_point, total_points,
//              user_expected_results!inner(home_score, away_score, match_id, user_id)`)
//     .eq('quiniela_id', quinielaId)
//     .eq('user_expected_results.user_id', userId)
//
// Chain: select(...) → eq('quiniela_id', ...) → eq('user_expected_results.user_id', ...)
// --------------------------------------------------------------------------
const mockPlayerPredictionsUserEq = jest.fn()  // second .eq (terminal) for findPlayerPredictionsForViewer
const mockPlayerPredictionsQuinielaEq = jest.fn(() => ({ eq: mockPlayerPredictionsUserEq }))  // first .eq

// --------------------------------------------------------------------------
// aggregateByQuiniela: extra_question_results select
//
//   from('extra_question_results').select('user_id, points').eq('quiniela_id', id)
//
// Terminal call is .eq('quiniela_id', id).
// --------------------------------------------------------------------------
const mockExtraResultsEq = jest.fn()  // terminal eq for extra_question_results

// --------------------------------------------------------------------------
// matches query chain (for findPlayerPredictionsForViewer step 2)
//
//   from('matches').select(...).in('id', matchIds)
// --------------------------------------------------------------------------
const mockMatchesIn = jest.fn()  // terminal .in for matches query
const mockMatchesSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  return { in: mockMatchesIn }
})

// --------------------------------------------------------------------------
// prediction_scores select router
// Routes schema check vs aggregation query vs findPlayerPredictions query.
// --------------------------------------------------------------------------
const mockPredictionScoresSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    // schema check: select('id').limit(0)
    return { limit: mockSchemaSelectLimit }
  }
  // findPlayerPredictionsForViewer: select with user_expected_results fields (home_score, away_score, match_id, user_id)
  // aggregateByQuiniela: select with user_expected_results (user_id only)
  // Differentiate by whether the select includes 'match_id' (findPlayerPredictionsForViewer)
  if (arg.includes('match_id')) {
    return { eq: mockPlayerPredictionsQuinielaEq }
  }
  // aggregateByQuiniela: select(multiline join string).eq('quiniela_id', id)
  return { eq: mockPredictionScoresEq }
})

// --------------------------------------------------------------------------
// extra_question_results select router
// Routes schema check vs data query.
// --------------------------------------------------------------------------
const mockExtraResultsSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  return { eq: mockExtraResultsEq }
})

// --------------------------------------------------------------------------
// from router: routes by table name
// --------------------------------------------------------------------------
const mockFrom = jest.fn((table: string) => {
  if (table === 'quiniela_memberships') {
    return { select: mockSelect }
  }
  if (table === 'prediction_scores') {
    return { select: mockPredictionScoresSelect }
  }
  if (table === 'extra_question_results') {
    return { select: mockExtraResultsSelect }
  }
  if (table === 'matches') {
    return { select: mockMatchesSelect }
  }
  // user_expected_results and other tables
  return { select: mockSelect }
})

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A shared prediction (quiniela_id IS NULL) */
const SHARED_PREDICTION = {
  id: 'pred-shared-1',
  user_id: 'user-uuid-1',
  home_score: 2,
  away_score: 1,
  quiniela_id: null,
}

/** A per-quiniela prediction (quiniela_id IS set) */
const PER_QUINIELA_PREDICTION = {
  id: 'pred-quin-1',
  user_id: 'user-uuid-2',
  home_score: 1,
  away_score: 0,
  quiniela_id: 'quiniela-uuid-A',
}

/** Approved membership rows */
const MEMBERSHIP_1 = { user_id: 'user-uuid-1', quiniela_id: 'quiniela-uuid-A' }
const MEMBERSHIP_2 = { user_id: 'user-uuid-1', quiniela_id: 'quiniela-uuid-B' }

function makeRepo() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce({ error: null })

  return new PredictionScoreRepository()
}

beforeEach(() => {
  jest.clearAllMocks()
  resetSupabaseServerClient()
  resetSchemaCheckCache()
  resetPlayerPredictionsCache()
})

// ---------------------------------------------------------------------------
// Constructor — env var validation
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – constructor', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    expect(() => new PredictionScoreRepository()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is required',
    )

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => new PredictionScoreRepository()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required',
    )

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })
})

// ---------------------------------------------------------------------------
// findPredictionsWithQuinielas — per-quiniela prediction
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPredictionsWithQuinielas (per-quiniela rows)', () => {
  it('returns the prediction with its own quiniela_id without fan-out', async () => {
    const repo = makeRepo()

    // Predictions query: only one per-quiniela prediction
    mockUerEq.mockResolvedValueOnce({
      data: [PER_QUINIELA_PREDICTION],
      error: null,
    })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      predictionId: PER_QUINIELA_PREDICTION.id,
      userId: PER_QUINIELA_PREDICTION.user_id,
      homeScore: PER_QUINIELA_PREDICTION.home_score,
      awayScore: PER_QUINIELA_PREDICTION.away_score,
      quinielaId: PER_QUINIELA_PREDICTION.quiniela_id,
    })
  })

  it('does NOT query quiniela_memberships for per-quiniela predictions', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [PER_QUINIELA_PREDICTION],
      error: null,
    })

    await repo.findPredictionsWithQuinielas('match-uuid')

    // quiniela_memberships should not be queried — no fan-out needed
    expect(mockMembershipsIn).not.toHaveBeenCalled()
  })

  it('yields one result per per-quiniela prediction (no duplication)', async () => {
    const repo = makeRepo()

    const prediction2 = {
      ...PER_QUINIELA_PREDICTION,
      id: 'pred-quin-2',
      quiniela_id: 'quiniela-uuid-B',
    }

    mockUerEq.mockResolvedValueOnce({
      data: [PER_QUINIELA_PREDICTION, prediction2],
      error: null,
    })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toHaveLength(2)
    expect(results[0].quinielaId).toBe('quiniela-uuid-A')
    expect(results[1].quinielaId).toBe('quiniela-uuid-B')
  })
})

// ---------------------------------------------------------------------------
// findPredictionsWithQuinielas — shared prediction (quiniela_id IS NULL)
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPredictionsWithQuinielas (shared rows)', () => {
  it('fans out across all approved memberships for the user', async () => {
    const repo = makeRepo()

    // Predictions query: one shared prediction
    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION],
      error: null,
    })
    // Memberships query: user belongs to two approved quinielas
    mockMembershipsNot.mockResolvedValueOnce({
      data: [MEMBERSHIP_1, MEMBERSHIP_2],
      error: null,
    })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    // Fan-out: one entry per membership
    expect(results).toHaveLength(2)
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predictionId: SHARED_PREDICTION.id,
          userId: SHARED_PREDICTION.user_id,
          quinielaId: 'quiniela-uuid-A',
        }),
        expect.objectContaining({
          predictionId: SHARED_PREDICTION.id,
          userId: SHARED_PREDICTION.user_id,
          quinielaId: 'quiniela-uuid-B',
        }),
      ]),
    )
  })

  it('queries quiniela_memberships with user_ids from shared predictions', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION],
      error: null,
    })
    mockMembershipsNot.mockResolvedValueOnce({
      data: [MEMBERSHIP_1],
      error: null,
    })

    await repo.findPredictionsWithQuinielas('match-uuid')

    expect(mockMembershipsIn).toHaveBeenCalledWith('user_id', [SHARED_PREDICTION.user_id])
  })

  it('returns [] when shared user has no approved memberships', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION],
      error: null,
    })
    mockMembershipsNot.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toHaveLength(0)
  })

  it('handles multiple shared predictions from different users', async () => {
    const repo = makeRepo()

    const sharedUser2 = {
      id: 'pred-shared-2',
      user_id: 'user-uuid-2',
      home_score: 0,
      away_score: 0,
      quiniela_id: null,
    }

    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION, sharedUser2],
      error: null,
    })
    mockMembershipsNot.mockResolvedValueOnce({
      data: [
        MEMBERSHIP_1,                                                    // user-uuid-1 → A
        { user_id: 'user-uuid-2', quiniela_id: 'quiniela-uuid-A' },    // user-uuid-2 → A
      ],
      error: null,
    })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toHaveLength(2)
    // Each user's prediction fans out into their memberships
    const quinielaIds = results.map((r) => r.quinielaId)
    expect(quinielaIds).toContain('quiniela-uuid-A')
  })
})

// ---------------------------------------------------------------------------
// findPredictionsWithQuinielas — mixed (both shared and per-quiniela)
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPredictionsWithQuinielas (mixed rows)', () => {
  it('handles a mix of shared and per-quiniela predictions in the same match', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION, PER_QUINIELA_PREDICTION],
      error: null,
    })
    mockMembershipsNot.mockResolvedValueOnce({
      data: [MEMBERSHIP_1, MEMBERSHIP_2],
      error: null,
    })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    // per-quiniela: 1 result; shared: 2 results (fan-out for user-uuid-1)
    expect(results).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// findPredictionsWithQuinielas — empty and error paths
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPredictionsWithQuinielas (edge cases)', () => {
  it('returns [] when there are no predictions for the match', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toEqual([])
  })

  it('returns [] when predictions data is null', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ data: null, error: null })

    const results = await repo.findPredictionsWithQuinielas('match-uuid')

    expect(results).toEqual([])
  })

  it('throws when the predictions query fails', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ error: { message: 'DB error on predictions' } })

    await expect(repo.findPredictionsWithQuinielas('match-uuid')).rejects.toThrow(
      'findPredictionsWithQuinielas failed: DB error on predictions',
    )
  })

  it('throws when the memberships query fails', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [SHARED_PREDICTION],
      error: null,
    })
    mockMembershipsNot.mockResolvedValueOnce({ error: { message: 'memberships fetch error' } })

    await expect(repo.findPredictionsWithQuinielas('match-uuid')).rejects.toThrow(
      'findPredictionsWithQuinielas memberships fetch failed: memberships fetch error',
    )
  })
})

// ---------------------------------------------------------------------------
// findCrowdOutcomes
//
// Chain: select('home_score, away_score').eq('match_id', matchId)
// Aggregates ALL predictions for the match regardless of quiniela_id.
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findCrowdOutcomes', () => {
  it('returns all (homeScore, awayScore) pairs for a match', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({
      data: [
        { home_score: 2, away_score: 1 },
        { home_score: 1, away_score: 1 },
        { home_score: 0, away_score: 3 },
      ],
      error: null,
    })

    const results = await repo.findCrowdOutcomes('match-uuid')

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ homeScore: 2, awayScore: 1 })
    expect(results[1]).toEqual({ homeScore: 1, awayScore: 1 })
    expect(results[2]).toEqual({ homeScore: 0, awayScore: 3 })
  })

  it('includes predictions with quiniela_id set and IS NULL (all rows)', async () => {
    const repo = makeRepo()

    // Three predictions: two shared, one per-quiniela — all are included
    mockUerEq.mockResolvedValueOnce({
      data: [
        { home_score: 2, away_score: 0 },
        { home_score: 2, away_score: 0 },
        { home_score: 1, away_score: 2 },
      ],
      error: null,
    })

    const results = await repo.findCrowdOutcomes('match-uuid')

    expect(results).toHaveLength(3)
    // No quiniela filtering — we get raw DB rows
    expect(mockUerEq).toHaveBeenCalledWith('match_id', 'match-uuid')
    // quiniela_memberships NOT queried — crowd does not filter by membership
    expect(mockMembershipsIn).not.toHaveBeenCalled()
  })

  it('returns [] when there are no predictions for the match', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findCrowdOutcomes('match-uuid')

    expect(results).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ data: null, error: null })

    const results = await repo.findCrowdOutcomes('match-uuid')

    expect(results).toEqual([])
  })

  it('throws "findCrowdOutcomes failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()

    mockUerEq.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findCrowdOutcomes('match-uuid')).rejects.toThrow(
      'findCrowdOutcomes failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// findCrowdOutcomesByMatchIds — batched crowd outcomes
//
// Chain:
//   from('user_expected_results')
//     .select('match_id, home_score, away_score')
//     .in('match_id', matchIds) → { data, error }
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findCrowdOutcomesByMatchIds', () => {
  it('groups rows by match id with a single query', async () => {
    const repo = makeRepo()

    mockUerInLimit.mockResolvedValueOnce({
      data: [
        { match_id: 'match-1', home_score: 2, away_score: 1 },
        { match_id: 'match-2', home_score: 0, away_score: 0 },
        { match_id: 'match-1', home_score: 1, away_score: 1 },
      ],
      error: null,
    })

    const grouped = await repo.findCrowdOutcomesByMatchIds(['match-1', 'match-2'])

    expect(mockUerIn).toHaveBeenCalledTimes(1)
    expect(mockUerIn).toHaveBeenCalledWith('match_id', ['match-1', 'match-2'])
    expect(mockUerInLimit).toHaveBeenCalledWith(100_000)
    expect(grouped.get('match-1')).toEqual([
      { homeScore: 2, awayScore: 1 },
      { homeScore: 1, awayScore: 1 },
    ])
    expect(grouped.get('match-2')).toEqual([{ homeScore: 0, awayScore: 0 }])
  })

  it('omits matches that have no predictions', async () => {
    const repo = makeRepo()

    mockUerInLimit.mockResolvedValueOnce({
      data: [{ match_id: 'match-1', home_score: 2, away_score: 1 }],
      error: null,
    })

    const grouped = await repo.findCrowdOutcomesByMatchIds(['match-1', 'match-without-predictions'])

    expect(grouped.has('match-without-predictions')).toBe(false)
    expect(grouped.size).toBe(1)
  })

  it('returns an empty map without querying when matchIds is empty', async () => {
    const repo = makeRepo()

    const grouped = await repo.findCrowdOutcomesByMatchIds([])

    expect(grouped.size).toBe(0)
    expect(mockUerIn).not.toHaveBeenCalled()
    expect(mockSchemaLimit).not.toHaveBeenCalled()
  })

  it('throws "findCrowdOutcomesByMatchIds failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()

    mockUerInLimit.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })

    await expect(repo.findCrowdOutcomesByMatchIds(['match-1'])).rejects.toThrow(
      'findCrowdOutcomesByMatchIds failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// aggregateByQuiniela — with extra_question_results extension
//
// Chain (prediction_scores):
//   from('prediction_scores').select(...).eq('quiniela_id', id) → { data, error }
//
// Chain (extra_question_results):
//   from('extra_question_results').select('user_id, points').eq('quiniela_id', id) → { data, error }
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – aggregateByQuiniela (extra points extension)', () => {
  it('adds extra question points on top of prediction scores for existing users', async () => {
    const repo = makeRepo()

    // prediction_scores query
    mockPredictionScoresEq.mockResolvedValueOnce({
      data: [
        {
          total_points: 3,
          home_goal_point: 1,
          away_goal_point: 1,
          outcome_point: 1,
          user_expected_results: { user_id: 'user-uuid-1' },
        },
      ],
      error: null,
    })
    // extra_question_results query
    mockExtraResultsEq.mockResolvedValueOnce({
      data: [{ user_id: 'user-uuid-1', points: 1 }],
      error: null,
    })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(
      expect.objectContaining({ userId: 'user-uuid-1', totalPoints: 4 }),
    )
  })

  it('creates a new entry for users with only extra question results (no prediction scores)', async () => {
    const repo = makeRepo()

    // prediction_scores query: empty
    mockPredictionScoresEq.mockResolvedValueOnce({ data: [], error: null })

    // extra_question_results query: one extra-only user
    mockExtraResultsEq.mockResolvedValueOnce({
      data: [{ user_id: 'extra-only-user', points: 1 }],
      error: null,
    })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      userId: 'extra-only-user',
      totalPoints: 1,
      exactScoreHits: 0,
      correctOutcomeHits: 0,
      predictedMatchCount: 0,
      homeGoalPoints: 0,
      awayGoalPoints: 0,
      outcomePoints: 0,
      extraQuestionPoints: 1,
    })
  })

  it('does not affect users who have only prediction scores (no extra results)', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({
      data: [
        {
          total_points: 2,
          home_goal_point: 1,
          away_goal_point: 0,
          outcome_point: 1,
          user_expected_results: { user_id: 'predict-only-user' },
        },
      ],
      error: null,
    })
    // No extra question results
    mockExtraResultsEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(
      expect.objectContaining({ userId: 'predict-only-user', totalPoints: 2 }),
    )
  })

  it('throws when the prediction_scores query fails', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error' },
    })

    await expect(repo.aggregateByQuiniela('quiniela-uuid')).rejects.toThrow(
      'aggregateByQuiniela failed',
    )
  })

  it('throws when the extra_question_results query fails', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({ data: [], error: null })
    mockExtraResultsEq.mockResolvedValueOnce({
      error: { message: 'permission denied on extra_question_results' },
    })

    await expect(repo.aggregateByQuiniela('quiniela-uuid')).rejects.toThrow(
      'aggregateByQuiniela extra_question_results failed: permission denied on extra_question_results',
    )
  })
})

// ---------------------------------------------------------------------------
// aggregateByQuiniela — point breakdown counters (new fields)
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – aggregateByQuiniela (point breakdown counters)', () => {
  it('accumulates homeGoalPoints, awayGoalPoints, outcomePoints across multiple prediction_score rows', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({
      data: [
        {
          total_points: 3,
          home_goal_point: 1,
          away_goal_point: 1,
          outcome_point: 1,
          user_expected_results: { user_id: 'user-A' },
        },
        {
          total_points: 2,
          home_goal_point: 0,
          away_goal_point: 1,
          outcome_point: 1,
          user_expected_results: { user_id: 'user-A' },
        },
        {
          total_points: 0,
          home_goal_point: 0,
          away_goal_point: 0,
          outcome_point: 0,
          user_expected_results: { user_id: 'user-A' },
        },
      ],
      error: null,
    })
    mockExtraResultsEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    expect(results[0].homeGoalPoints).toBe(1)
    expect(results[0].awayGoalPoints).toBe(2)
    expect(results[0].outcomePoints).toBe(2)
    expect(results[0].extraQuestionPoints).toBe(0)
    expect(results[0].totalPoints).toBe(5)
  })

  it('homeGoalPoints + awayGoalPoints + outcomePoints + extraQuestionPoints === totalPoints for a mixed user', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({
      data: [
        {
          total_points: 1,
          home_goal_point: 0,
          away_goal_point: 0,
          outcome_point: 1,
          user_expected_results: { user_id: 'user-B' },
        },
        {
          total_points: 3,
          home_goal_point: 1,
          away_goal_point: 1,
          outcome_point: 1,
          user_expected_results: { user_id: 'user-B' },
        },
      ],
      error: null,
    })
    mockExtraResultsEq.mockResolvedValueOnce({
      data: [{ user_id: 'user-B', points: 2 }],
      error: null,
    })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    const row = results[0]
    expect(row.homeGoalPoints + row.awayGoalPoints + row.outcomePoints + row.extraQuestionPoints).toBe(row.totalPoints)
    expect(row.totalPoints).toBe(6)
    expect(row.extraQuestionPoints).toBe(2)
  })

  it('user with extra question points only gets correct extraQuestionPoints and zeros for others', async () => {
    const repo = makeRepo()

    mockPredictionScoresEq.mockResolvedValueOnce({ data: [], error: null })
    mockExtraResultsEq.mockResolvedValueOnce({
      data: [{ user_id: 'extra-only', points: 3 }],
      error: null,
    })

    const results = await repo.aggregateByQuiniela('quiniela-uuid')

    expect(results).toHaveLength(1)
    expect(results[0].extraQuestionPoints).toBe(3)
    expect(results[0].homeGoalPoints).toBe(0)
    expect(results[0].awayGoalPoints).toBe(0)
    expect(results[0].outcomePoints).toBe(0)
    expect(results[0].totalPoints).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// findPlayerPredictionsForViewer
//
// Step 1: from('prediction_scores').select(...).eq('quiniela_id', ...).eq('user_expected_results.user_id', ...)
// Step 2: from('matches').select(...).in('id', matchIds)
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPlayerPredictionsForViewer', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const USER_ID = 'user-uuid-1'

  const PRED_ROW = {
    home_goal_point: 1,
    away_goal_point: 1,
    outcome_point: 1,
    total_points: 3,
    user_expected_results: {
      home_score: 2,
      away_score: 1,
      match_id: 'match-uuid-1',
      user_id: USER_ID,
    },
  }

  const FINISHED_MATCH = {
    id: 'match-uuid-1',
    home_team_name: 'Germany',
    away_team_name: 'Scotland',
    scheduled_at: '2026-06-14T16:00:00Z',
    status: 'FINISHED',
    regulation_home_goals: 2,
    regulation_away_goals: 1,
  }

  it('returns PlayerPredictionEntry[] for FINISHED matches with non-null goals', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
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
    })
  })

  it('returns [] when step 1 yields no rows', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toEqual([])
    expect(mockMatchesIn).not.toHaveBeenCalled()
  })

  it('returns [] when step 1 data is null', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: null, error: null })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toEqual([])
    expect(mockMatchesIn).not.toHaveBeenCalled()
  })

  it('returns [] when all matches have status !== FINISHED', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [{ ...FINISHED_MATCH, status: 'SCHEDULED' }],
      error: null,
    })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toEqual([])
  })

  it('returns [] when regulation goals are null even if status is FINISHED', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [{ ...FINISHED_MATCH, regulation_home_goals: null, regulation_away_goals: null }],
      error: null,
    })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toEqual([])
  })

  it('filters out unfinished matches while keeping finished ones', async () => {
    const repo = makeRepo()

    const predRow2 = {
      ...PRED_ROW,
      total_points: 0,
      home_goal_point: 0,
      away_goal_point: 0,
      outcome_point: 0,
      user_expected_results: {
        ...PRED_ROW.user_expected_results,
        match_id: 'match-uuid-2',
      },
    }

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW, predRow2],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [
        FINISHED_MATCH,
        { ...FINISHED_MATCH, id: 'match-uuid-2', status: 'IN_PLAY', regulation_home_goals: null, regulation_away_goals: null },
      ],
      error: null,
    })

    const results = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(results).toHaveLength(1)
    expect(results[0].matchId).toBe('match-uuid-1')
  })

  it('throws on step 1 Supabase error', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      error: { message: 'prediction_scores query failed' },
    })

    await expect(repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)).rejects.toThrow(
      'findPlayerPredictionsForViewer failed: prediction_scores query failed',
    )
  })

  it('throws on step 2 Supabase error', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      error: { message: 'matches fetch failed' },
    })

    await expect(repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)).rejects.toThrow(
      'findPlayerPredictionsForViewer matches fetch failed: matches fetch failed',
    )
  })
})

// ---------------------------------------------------------------------------
// findPlayerPredictionsForViewer — caching (admin impersonation Decision B)
//
// Two TtlCache instances, both keyed `${quinielaId}:${userId}`:
//   - playerPredictionsCache             (30s) — default / isImpersonating: false
//   - impersonatedPlayerPredictionsCache (5s)  — isImpersonating: true
//
// resetPlayerPredictionsCache() clears both and is called in beforeEach.
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – findPlayerPredictionsForViewer (caching)', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const USER_ID = 'user-uuid-1'

  const PRED_ROW = {
    home_goal_point: 1,
    away_goal_point: 1,
    outcome_point: 1,
    total_points: 3,
    user_expected_results: {
      home_score: 2,
      away_score: 1,
      match_id: 'match-uuid-1',
      user_id: USER_ID,
    },
  }

  const FINISHED_MATCH = {
    id: 'match-uuid-1',
    home_team_name: 'Germany',
    away_team_name: 'Scotland',
    scheduled_at: '2026-06-14T16:00:00Z',
    status: 'FINISHED',
    regulation_home_goals: 2,
    regulation_away_goals: 1,
  }

  it('caches results on the normal cache for a second identical call (no re-query)', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    const first = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)
    expect(first).toHaveLength(1)

    // Second call: no mocks queued — would throw/return undefined if it hit Supabase again.
    const second = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(second).toEqual(first)
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(1)
    expect(mockMatchesIn).toHaveBeenCalledTimes(1)
  })

  it('caches empty results too (no re-query when step 1 yields no rows)', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [], error: null })

    const first = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)
    const second = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    expect(first).toEqual([])
    expect(second).toEqual([])
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(1)
  })

  it('isolates cache entries by (quinielaId, userId) — different user triggers a fresh query', async () => {
    const repo = makeRepo()

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    // Different userId → cache miss → second query
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [{ ...PRED_ROW, user_expected_results: { ...PRED_ROW.user_expected_results, user_id: 'user-uuid-2' } }],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, 'user-uuid-2')

    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)
  })

  it('isImpersonating: true and the default (false/undefined) reads use separate caches', async () => {
    const repo = makeRepo()

    // First call: normal (non-impersonating) read — populates playerPredictionsCache
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    const normalResult = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)
    expect(normalResult).toHaveLength(1)

    // Second call: same (quinielaId, userId) but isImpersonating: true — should be a
    // cache MISS on impersonatedPlayerPredictionsCache, triggering a fresh query.
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({
      data: [PRED_ROW],
      error: null,
    })
    mockMatchesIn.mockResolvedValueOnce({
      data: [FINISHED_MATCH],
      error: null,
    })

    const impersonatedResult = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID, {
      isImpersonating: true,
    })
    expect(impersonatedResult).toHaveLength(1)

    // Both queries actually ran (one per cache)
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)

    // A third call with isImpersonating: true again should hit the impersonated cache
    const impersonatedSecond = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID, {
      isImpersonating: true,
    })
    expect(impersonatedSecond).toEqual(impersonatedResult)
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)

    // And a fourth call without isImpersonating should still hit the normal cache
    const normalSecond = await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)
    expect(normalSecond).toEqual(normalResult)
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// invalidatePlayerPredictionsCache
// ---------------------------------------------------------------------------

describe('PredictionScoreRepository – invalidatePlayerPredictionsCache', () => {
  const QUINIELA_ID = 'quiniela-uuid'
  const USER_ID = 'user-uuid-1'

  const PRED_ROW = {
    home_goal_point: 1,
    away_goal_point: 1,
    outcome_point: 1,
    total_points: 3,
    user_expected_results: {
      home_score: 2,
      away_score: 1,
      match_id: 'match-uuid-1',
      user_id: USER_ID,
    },
  }

  const FINISHED_MATCH = {
    id: 'match-uuid-1',
    home_team_name: 'Germany',
    away_team_name: 'Scotland',
    scheduled_at: '2026-06-14T16:00:00Z',
    status: 'FINISHED',
    regulation_home_goals: 2,
    regulation_away_goals: 1,
  }

  it('clears both the normal and impersonated cache entries for the given key', async () => {
    const repo = makeRepo()

    // Populate normal cache
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    // Populate impersonated cache
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID, { isImpersonating: true })

    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)

    // Invalidate both
    repo.invalidatePlayerPredictionsCache(QUINIELA_ID, USER_ID)

    // Both reads should re-query now
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID, { isImpersonating: true })

    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(4)
  })

  it('does not affect cache entries for other (quinielaId, userId) keys', async () => {
    const repo = makeRepo()

    // Populate cache for USER_ID
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)

    // Populate cache for a different user
    const otherUserPredRow = {
      ...PRED_ROW,
      user_expected_results: { ...PRED_ROW.user_expected_results, user_id: 'user-uuid-2' },
    }
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [otherUserPredRow], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, 'user-uuid-2')

    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(2)

    // Invalidate only USER_ID's entry
    repo.invalidatePlayerPredictionsCache(QUINIELA_ID, USER_ID)

    // USER_ID re-queries
    mockPlayerPredictionsUserEq.mockResolvedValueOnce({ data: [PRED_ROW], error: null })
    mockMatchesIn.mockResolvedValueOnce({ data: [FINISHED_MATCH], error: null })
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, USER_ID)
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(3)

    // user-uuid-2 still cached — no additional query
    await repo.findPlayerPredictionsForViewer(QUINIELA_ID, 'user-uuid-2')
    expect(mockPlayerPredictionsUserEq).toHaveBeenCalledTimes(3)
  })
})
