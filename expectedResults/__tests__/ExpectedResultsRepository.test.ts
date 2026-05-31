/**
 * Unit tests for ExpectedResultsRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover all four public methods: upsert (insert + update idempotency),
 * findByUserId (found / empty), and deleteByUserId (delete / no-op).
 * Follows the same mock-chain pattern as CompetitionsRepository.test.ts and
 * UsersRepository.test.ts.
 *
 * Call chains on the `user_expected_results` table:
 *
 *   1. Schema-check:
 *        from('user_expected_results').select('id').limit(0) → { error }
 *
 *   2. upsert:
 *        from('user_expected_results').upsert({...}, { onConflict: 'user_id,match_id' }) → { error }
 *
 *   3. findByUserId:
 *        from('user_expected_results').select('*').eq('user_id', userId) → { data, error }
 *
 *   4. deleteByUserId:
 *        from('user_expected_results').delete().eq('user_id', userId) → { error }
 */

import { ExpectedResultsRepository } from '../ExpectedResultsRepository'

// ---------------------------------------------------------------------------
// Mock plumbing
// ---------------------------------------------------------------------------

// Schema-check terminator: limit(0) → Promise<{ error }>
const mockSchemaLimit = jest.fn()

// upsert terminator: .upsert(rows, opts) → Promise<{ error }>
const mockUpsert = jest.fn()

// findByUserId chain: .select('*').eq('user_id', id) → Promise<{ data, error }>
const mockFindEq = jest.fn()

// deleteByUserId chain: .delete().eq('user_id', id) → Promise<{ error }>
const mockDeleteEq = jest.fn()
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }))

// Schema-check select: .select('id').limit(0)
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  return Promise.resolve({ data: null, error: null })
})

// Combined select: routes on argument
// 'id'  → schema-check path
// '*'   → findByUserId path
const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  // '*' → data path
  return { eq: mockFindEq }
})

// Router
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
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
  home_score: 2,
  away_score: 1,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

const DB_ROW_2 = {
  id: 'result-uuid-2',
  user_id: 'user-uuid',
  match_id: 'match-uuid-2',
  home_score: 0,
  away_score: 0,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

/**
 * Set env vars, prime the schema-check mock, and return a new repo instance.
 */
function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists ? { error: null } : { error: { message: 'relation does not exist' } },
  )

  return new ExpectedResultsRepository()
}

/** Set env vars without priming any schema mock. */
function setEnvVars() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
}

beforeEach(() => {
  jest.clearAllMocks()
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
    mockFindEq.mockResolvedValueOnce({ data: [], error: null })

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
    mockFindEq
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
// upsert — insert new row
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – upsert (insert)', () => {
  it('calls upsert with correct snake_case payload', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    await repo.upsert({
      userId: 'user-uuid',
      matchId: 'match-uuid',
      homeScore: 2,
      awayScore: 1,
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-uuid',
        match_id: 'match-uuid',
        home_score: 2,
        away_score: 1,
      },
      { onConflict: 'user_id,match_id' },
    )
  })

  it('resolves without error on a successful insert', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    await expect(
      repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 3, awayScore: 0 }),
    ).resolves.toBeUndefined()
  })

  it('throws "upsert expected result failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: { message: 'unique constraint' } })

    await expect(
      repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 1, awayScore: 1 }),
    ).rejects.toThrow('upsert expected result failed: unique constraint')
  })
})

// ---------------------------------------------------------------------------
// upsert — update existing row (idempotent on user_id + match_id)
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – upsert (update / idempotent)', () => {
  it('is idempotent: calling upsert twice with the same key produces no error', async () => {
    const repo = makeRepo()
    // The schema check is consumed on the first upsert call, so only one schema
    // mock is needed. Both upsert calls succeed.
    mockUpsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 2, awayScore: 1 })
    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 3, awayScore: 2 })

    expect(mockUpsert).toHaveBeenCalledTimes(2)
    // Second call should still use the same conflict target
    expect(mockUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: 'user-uuid', match_id: 'match-uuid', home_score: 3, away_score: 2 }),
      { onConflict: 'user_id,match_id' },
    )
  })

  it('passes scores of 0,0 correctly (valid edge case)', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    await repo.upsert({ userId: 'user-uuid', matchId: 'match-uuid', homeScore: 0, awayScore: 0 })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ home_score: 0, away_score: 0 }),
      expect.any(Object),
    )
  })
})

// ---------------------------------------------------------------------------
// findByUserId
// ---------------------------------------------------------------------------

describe('ExpectedResultsRepository – findByUserId', () => {
  it('returns mapped ExpectedResult objects for a user with results', async () => {
    const repo = makeRepo()
    mockFindEq.mockResolvedValueOnce({ data: [DB_ROW, DB_ROW_2], error: null })

    const results = await repo.findByUserId('user-uuid')

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      id: 'result-uuid',
      userId: 'user-uuid',
      matchId: 'match-uuid',
      homeScore: 2,
      awayScore: 1,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    })
    expect(results[1]).toEqual({
      id: 'result-uuid-2',
      userId: 'user-uuid',
      matchId: 'match-uuid-2',
      homeScore: 0,
      awayScore: 0,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    })
  })

  it('returns [] when the user has no results (empty array)', async () => {
    const repo = makeRepo()
    mockFindEq.mockResolvedValueOnce({ data: [], error: null })

    const results = await repo.findByUserId('user-no-results')

    expect(results).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const repo = makeRepo()
    mockFindEq.mockResolvedValueOnce({ data: null, error: null })

    const results = await repo.findByUserId('user-no-results')

    expect(results).toEqual([])
  })

  it('queries by user_id column', async () => {
    const repo = makeRepo()
    mockFindEq.mockResolvedValueOnce({ data: [], error: null })

    await repo.findByUserId('user-uuid')

    expect(mockFindEq).toHaveBeenCalledWith('user_id', 'user-uuid')
  })

  it('throws "findByUserId failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockFindEq.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findByUserId('user-uuid')).rejects.toThrow(
      'findByUserId failed: permission denied',
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
    // Supabase DELETE with no matching rows returns { error: null } — the
    // repository should treat this the same as a successful delete.
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
