/**
 * Unit tests for ExpectedResultsRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover all public methods: upsert (insert + update idempotency),
 * findByUserId (found / empty), findByMatchId, deleteByUserId,
 * and findByUserIdAndQuiniela (null quiniela_id / specific quiniela_id).
 *
 * Call chains on the `user_expected_results` table:
 *
 *   1. Schema-check:
 *        from('user_expected_results').select('id').limit(0) → { error }
 *
 *   2. upsert (pre-check):
 *        from('user_expected_results').select('id, submitted_at').eq(...).eq(...).is()/eq().maybeSingle()
 *        → { data, error }
 *
 *   3. upsert (insert — new row):
 *        from('user_expected_results').insert({...}) → { error }
 *
 *   4. upsert (update — existing row):
 *        from('user_expected_results').update({...}).eq('id', existingId) → { error }
 *
 *   5. findByUserId:
 *        from('user_expected_results').select('*').eq('user_id', userId) → { data, error }
 *
 *   6. findByMatchId:
 *        from('user_expected_results').select('*').eq('match_id', matchId) → { data, error }
 *
 *   7. deleteByUserId:
 *        from('user_expected_results').delete().eq('user_id', userId) → { error }
 *
 *   8. findByUserIdAndQuiniela:
 *        from('user_expected_results').select('*').eq('user_id', userId).eq/is('quiniela_id', ...) → { data, error }
 */

import { ExpectedResultsRepository } from '../ExpectedResultsRepository'
import { resetSupabaseServerClient } from '@/lib/supabaseServerClient'
import { resetSchemaCheckCache } from '@/lib/schemaCheckCache'

// ---------------------------------------------------------------------------
// Mock plumbing
// ---------------------------------------------------------------------------

// Schema-check terminator: limit(0) → Promise<{ error }>
const mockSchemaLimit = jest.fn()

// INSERT terminator: .insert(row) → Promise<{ error }>
const mockInsert = jest.fn()

// UPDATE chain:
//   .update(payload).eq('id', existingId) → Promise<{ error }>
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))

// deleteByUserId chain: .delete().eq('user_id', id) → Promise<{ error }>
const mockDeleteEq = jest.fn()
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }))

// Upsert pre-check chain:
//   shared:   .select('id, submitted_at').eq(user_id).eq(match_id).is('quiniela_id', null).maybeSingle()
//   per-quin: .select('id, submitted_at').eq(user_id).eq(match_id).eq('quiniela_id', id).maybeSingle()
const mockPreCheckMaybeSingle = jest.fn()
const mockPreCheckLastFilter = jest.fn(() => ({ maybeSingle: mockPreCheckMaybeSingle }))
const mockPreCheckEq2 = jest.fn(() => ({
  eq: mockPreCheckLastFilter,
  is: mockPreCheckLastFilter,
  maybeSingle: mockPreCheckMaybeSingle,
}))
const mockPreCheckEq1 = jest.fn(() => ({ eq: mockPreCheckEq2 }))

// ----------------------------------------------------------------------------
// findByUserId, findByMatchId, findByUserIdAndQuiniela share the select('*') path.
//
// findByUserId / findByMatchId:
//   select('*').eq('<col>', value)  — result is awaited directly
//
// findByUserIdAndQuiniela:
//   select('*').eq('user_id', id) → query object with .eq / .is
//              .eq/is('quiniela_id', ...) — result is awaited
//
// Strategy: select('*') returns { eq: mockDataEq }.
//   mockDataEq always returns a thenable object { data, error } AND
//   also exposes .eq and .is methods that point to mockDataQuinielaFilter.
//   mockDataQuinielaFilter returns the actual awaitable result.
//
// For findByUserId/findByMatchId: await mockDataEq('col', val) → {data, error}
// For findByUserIdAndQuiniela:
//   mockDataEq('user_id', id) returns { eq: mockDataQuinielaFilter, is: mockDataQuinielaFilter }
//   then await mockDataQuinielaFilter('quiniela_id', val) → {data, error}
// ----------------------------------------------------------------------------

const mockDataQuinielaFilter = jest.fn() // terminal for findByUserIdAndQuiniela

// mockDataEq is called for the FIRST .eq() after select('*')
// It must resolve as {data, error} for findByUserId/findByMatchId
// AND return chain-able { eq, is } for findByUserIdAndQuiniela.
// We'll use a factory function that returns a resolved-promise-like object with .eq/.is.
const mockDataEq = jest.fn()

// Schema-check select: .select('id').limit(0)
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  return Promise.resolve({ data: null, error: null })
})

const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  if (arg === 'id, submitted_at') {
    return { eq: mockPreCheckEq1 }
  }
  // '*' → data path
  return { eq: mockDataEq }
})

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DB_ROW = {
  id: 'result-uuid',
  user_id: 'user-uuid',
  match_id: 'match-uuid',
  quiniela_id: null,
  home_score: 2,
  away_score: 1,
  locked_at: null,
  submitted_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

const DB_ROW_2 = {
  id: 'result-uuid-2',
  user_id: 'user-uuid',
  match_id: 'match-uuid-2',
  quiniela_id: null,
  home_score: 0,
  away_score: 0,
  locked_at: null,
  submitted_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

const DB_ROW_QUINIELA = {
  ...DB_ROW,
  id: 'result-uuid-q',
  quiniela_id: 'quiniela-uuid',
}

function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists ? { error: null } : { error: { message: 'relation does not exist' } },
  )

  return new ExpectedResultsRepository()
}

function setEnvVars() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
}

beforeEach(() => {
  jest.clearAllMocks()
  resetSupabaseServerClient()
  resetSchemaCheckCache()
})

// ---------------------------------------------------------------------------
// Constructor — env var validation
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – constructor', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    expect(() => new ExpectedResultsRepository()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is required',
    )

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => new ExpectedResultsRepository()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required',
    )

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })
})

// ---------------------------------------------------------------------------
// verifySchema
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – verifySchema', () => {
  it('proceeds normally when the user_expected_results table exists', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockDataEq.mockResolvedValueOnce({ data: [], error: null })

    const repo = new ExpectedResultsRepository()
    const result = await repo.findByUserId('user-uuid')
    expect(result).toEqual([])
  })

  it('throws the descriptive error when the table does not exist', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: { message: 'relation does not exist' } })

    const repo = new ExpectedResultsRepository()
    await expect(repo.findByUserId('user-uuid')).rejects.toThrow(
      'Supabase table "public.user_expected_results" does not exist — run pending migrations before starting the application.',
    )
  })

  it('calls the schema check only once across multiple method calls on the same instance', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockDataEq
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const repo = new ExpectedResultsRepository()
    await repo.findByUserId('user-uuid')
    await repo.findByUserId('user-uuid')

    expect(mockSchemaSelectLimit).toHaveBeenCalledWith(0)
    expect(mockSchemaSelectLimit).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// upsert — insert new row (no existing row found in pre-check)
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – upsert (insert)', () => {
  it('calls insert with correct snake_case payload including submitted_at when inserting', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: null })

    await repo.upsert({
      userId: 'user-uuid',
      matchId: 'match-uuid',
      homeScore: 2,
      awayScore: 1,
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-uuid',
        match_id: 'match-uuid',
        home_score: 2,
        away_score: 1,
        submitted_at: expect.any(String),
      }),
    )
  })

  it('resolves without error on a successful insert', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: null })

    await expect(
      repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 3, awayScore: 0 }),
    ).resolves.toBeUndefined()
  })

  it('throws "upsert expected result failed: <msg>" on Supabase error during insert', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: { message: 'unique constraint' } })

    await expect(
      repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 1, awayScore: 1 }),
    ).rejects.toThrow('upsert expected result failed: unique constraint')
  })
})

// ---------------------------------------------------------------------------
// upsert — update existing row (idempotent on user_id + match_id)
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – upsert (update / idempotent)', () => {
  it('does NOT include submitted_at when updating an existing row', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-uuid', submitted_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await repo.upsert({
      userId: 'user-uuid',
      matchId: 'match-uuid',
      homeScore: 3,
      awayScore: 2,
    })

    const updatePayload = (mockUpdate as jest.Mock).mock.calls[0][0] as Record<string, unknown>
    expect(updatePayload.submitted_at).toBeUndefined()
  })

  it('calls update with the existing row id when a pre-existing row is found', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-uuid', submitted_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await repo.upsert({
      userId: 'user-uuid',
      matchId: 'match-uuid',
      homeScore: 3,
      awayScore: 2,
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ home_score: 3, away_score: 2 }),
    )
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'existing-uuid')
  })

  it('is idempotent: calling upsert twice with the same key produces no error', async () => {
    const repo = makeRepo()
    // First call: insert (no existing row)
    mockPreCheckMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: null })
    // Second call: update (existing row)
    mockPreCheckMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-uuid', submitted_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 2, awayScore: 1 })
    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 3, awayScore: 2 })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ home_score: 3, away_score: 2 }),
    )
  })

  it('passes scores of 0,0 correctly (valid edge case)', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: null })

    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 0, awayScore: 0 })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ home_score: 0, away_score: 0 }),
    )
  })

  it('throws "upsert expected result failed: <msg>" on Supabase error during update', async () => {
    const repo = makeRepo()
    mockPreCheckMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-uuid', submitted_at: '2026-01-01T00:00:00Z' },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'update constraint' } })

    await expect(
      repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 1, awayScore: 1 }),
    ).rejects.toThrow('upsert expected result failed: update constraint')
  })
})

// ---------------------------------------------------------------------------
// findByUserId
//
// Chain: select('*').eq('user_id', userId) → awaited as { data, error }
// mockDataEq is called with ('user_id', userId) and resolves as { data, error }
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – findByUserId', () => {
  it('returns mapped ExpectedResult objects for a user with results', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: [DB_ROW, DB_ROW_2], error: null })

    const results = await repo.findByUserId('user-uuid')

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      id: 'result-uuid',
      userId: 'user-uuid',
      matchId: 'match-uuid',
      quinielaId: null,
      homeScore: 2,
      awayScore: 1,
      lockedAt: null,
      submittedAt: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    })
    expect(results[1]).toEqual({
      id: 'result-uuid-2',
      userId: 'user-uuid',
      matchId: 'match-uuid-2',
      quinielaId: null,
      homeScore: 0,
      awayScore: 0,
      lockedAt: null,
      submittedAt: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    })
  })

  it('returns [] when the user has no results (empty array)', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findByUserId('user-no-results')

    expect(results).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: null, error: null })

    const results = await repo.findByUserId('user-no-results')

    expect(results).toEqual([])
  })

  it('queries by user_id column', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: [], error: null })

    await repo.findByUserId('user-uuid')

    expect(mockDataEq).toHaveBeenCalledWith('user_id', 'user-uuid')
  })

  it('throws "findByUserId failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findByUserId('user-uuid')).rejects.toThrow(
      'findByUserId failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// findByMatchId
//
// Chain: select('*').eq('match_id', matchId) → awaited as { data, error }
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – findByMatchId', () => {
  it('returns mapped ExpectedResult objects for a match', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: [DB_ROW], error: null })

    const results = await repo.findByMatchId('match-uuid')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'result-uuid',
      matchId: 'match-uuid',
      homeScore: 2,
      awayScore: 1,
    })
    expect(mockDataEq).toHaveBeenCalledWith('match_id', 'match-uuid')
  })

  it('returns [] when no results for the match', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findByMatchId('match-no-results')

    expect(results).toEqual([])
  })

  it('throws "findByMatchId failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockDataEq.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findByMatchId('match-uuid')).rejects.toThrow(
      'findByMatchId failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// deleteByUserId
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – deleteByUserId', () => {
  it('calls delete with the correct user_id filter', async () => {
    const repo = makeRepo()
    mockDeleteEq.mockResolvedValueOnce({ error: null })

    await repo.deleteByUserId('user-uuid')

    expect(mockDelete).toHaveBeenCalled()
    expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'user-uuid')
  })

  it('resolves without error when rows exist and are deleted', async () => {
    const repo = makeRepo()
    mockDeleteEq.mockResolvedValueOnce({ error: null })

    await expect(repo.deleteByUserId('user-uuid')).resolves.toBeUndefined()
  })

  it('is a no-op (resolves without error) when the user has no rows', async () => {
    const repo = makeRepo()
    mockDeleteEq.mockResolvedValueOnce({ error: null })

    await expect(repo.deleteByUserId('user-with-no-results')).resolves.toBeUndefined()
  })

  it('throws "deleteByUserId failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.deleteByUserId('user-uuid')).rejects.toThrow(
      'deleteByUserId failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// findByUserIdAndQuiniela
//
// Chain: select('*').eq('user_id', userId) → returns chain object
//        .eq('quiniela_id', id)  OR  .is('quiniela_id', null)
//        → awaited as { data, error }
//
// mockDataEq('user_id', userId) must return { eq, is } for the second filter.
// mockDataQuinielaFilter is then called as the final terminator.
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – findByUserIdAndQuiniela', () => {
  describe('with quinielaId = null (shared predictions)', () => {
    it('filters quiniela_id IS NULL when quinielaId is null', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [DB_ROW], error: null })

      await repo.findByUserIdAndQuiniela('user-uuid', null)

      expect(mockDataEq).toHaveBeenCalledWith('user_id', 'user-uuid')
      // null quinielaId → .is('quiniela_id', null)
      expect(mockDataQuinielaFilter).toHaveBeenCalledWith('quiniela_id', null)
    })

    it('returns mapped results for shared predictions', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [DB_ROW, DB_ROW_2], error: null })

      const results = await repo.findByUserIdAndQuiniela('user-uuid', null)

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        id: 'result-uuid',
        userId: 'user-uuid',
        matchId: 'match-uuid',
        quinielaId: null,
        homeScore: 2,
        awayScore: 1,
      })
    })

    it('returns [] when no shared predictions exist', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [], error: null })

      const results = await repo.findByUserIdAndQuiniela('user-uuid', null)

      expect(results).toEqual([])
    })

    it('throws "findByUserIdAndQuiniela failed: <msg>" on Supabase error', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ error: { message: 'permission denied' } })

      await expect(repo.findByUserIdAndQuiniela('user-uuid', null)).rejects.toThrow(
        'findByUserIdAndQuiniela failed: permission denied',
      )
    })
  })

  describe('with a specific quinielaId', () => {
    it('filters quiniela_id = <quinielaId> when quinielaId is set', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [DB_ROW_QUINIELA], error: null })

      await repo.findByUserIdAndQuiniela('user-uuid', 'quiniela-uuid')

      expect(mockDataEq).toHaveBeenCalledWith('user_id', 'user-uuid')
      // non-null quinielaId → .eq('quiniela_id', 'quiniela-uuid')
      expect(mockDataQuinielaFilter).toHaveBeenCalledWith('quiniela_id', 'quiniela-uuid')
    })

    it('returns mapped results for per-quiniela predictions', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [DB_ROW_QUINIELA], error: null })

      const results = await repo.findByUserIdAndQuiniela('user-uuid', 'quiniela-uuid')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'result-uuid-q',
        userId: 'user-uuid',
        quinielaId: 'quiniela-uuid',
      })
    })

    it('returns [] when no predictions exist for that quiniela', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ data: [], error: null })

      const results = await repo.findByUserIdAndQuiniela('user-uuid', 'quiniela-uuid')

      expect(results).toEqual([])
    })

    it('throws "findByUserIdAndQuiniela failed: <msg>" on Supabase error', async () => {
      const repo = makeRepo()
      mockDataEq.mockReturnValueOnce({
        eq: mockDataQuinielaFilter,
        is: mockDataQuinielaFilter,
      })
      mockDataQuinielaFilter.mockResolvedValueOnce({ error: { message: 'DB error' } })

      await expect(repo.findByUserIdAndQuiniela('user-uuid', 'quiniela-uuid')).rejects.toThrow(
        'findByUserIdAndQuiniela failed: DB error',
      )
    })
  })
})
