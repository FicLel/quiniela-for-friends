/**
 * Unit tests for AppSettingsRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover all public methods: find, setPredictionMode, findOldestQuinielaId,
 * and migrateSharedPredictions.
 *
 * Call chains on the `app_settings` table:
 *
 *   1. Schema-check:
 *        from('app_settings').select('id').limit(0) → { error }
 *
 *   2. find:
 *        from('app_settings').select('*').limit(1).maybeSingle() → { data, error }
 *
 *   3. setPredictionMode (update path):
 *        from('app_settings').update({...}).gt(...).select('id', {count:'exact'}) → { count, error }
 *
 *   4. setPredictionMode (insert path, when count=0):
 *        from('app_settings').insert({...}) → { error }
 *
 *   5. findOldestQuinielaId:
 *        from('quiniela_memberships').select(...).not(...).order(...).limit(1).maybeSingle() → { data, error }
 *
 *   6. migrateSharedPredictions:
 *        from('user_expected_results').update({...}).is('quiniela_id', null) → { error }
 */

import { AppSettingsRepository, resetAppSettingsCache } from '../AppSettingsRepository'
import { resetSupabaseServerClient } from '@/lib/supabaseServerClient'
import { resetSchemaCheckCache } from '@/lib/schemaCheckCache'

// ---------------------------------------------------------------------------
// Mock plumbing — app_settings table
// ---------------------------------------------------------------------------

// Schema-check: .select('id').limit(0) → Promise<{ error }>
const mockSchemaLimit = jest.fn()

// find: .select('*').limit(1).maybeSingle() → Promise<{ data, error }>
// Also used by setPredictionMode existence-check: .select('id').limit(1).maybeSingle()
const mockFindMaybySingle = jest.fn()
const mockFindLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  // n === 1 — either find() or existence-check after update
  return { maybeSingle: mockFindMaybySingle }
})

// setPredictionMode update: .update({}).gt()
const mockUpdateGt = jest.fn()
const mockUpdate = jest.fn(() => ({ gt: mockUpdateGt }))

// setPredictionMode insert fallback
const mockInsert = jest.fn()

// Combined select: routes on argument
// Both 'id' and '*' share the same limit chain (limit(0) = schema check, limit(1) = data)
const mockSelect = jest.fn((_arg: string) => ({ limit: mockFindLimit }))

// ---------------------------------------------------------------------------
// Mock plumbing — quiniela_memberships table
// ---------------------------------------------------------------------------

const mockMembershipsMaybeSingle = jest.fn()
const mockMembershipsLimit = jest.fn(() => ({ maybeSingle: mockMembershipsMaybeSingle }))
// mockMembershipsOrder supports chaining multiple .order() calls by returning both order and limit
const mockMembershipsOrder: jest.Mock = jest.fn(() => ({
  order: mockMembershipsOrder,
  limit: mockMembershipsLimit,
}))
const mockMembershipsNot = jest.fn(() => ({ order: mockMembershipsOrder }))
const mockMembershipsSelect = jest.fn(() => ({ not: mockMembershipsNot }))

// ---------------------------------------------------------------------------
// Mock plumbing — user_expected_results table
// ---------------------------------------------------------------------------

const mockMigrateIs = jest.fn()
const mockMigrateUpdate = jest.fn(() => ({ is: mockMigrateIs }))

// ---------------------------------------------------------------------------
// Router: from() dispatches based on table name
// ---------------------------------------------------------------------------

const mockFrom = jest.fn((table: string) => {
  if (table === 'quiniela_memberships') {
    return { select: mockMembershipsSelect }
  }
  if (table === 'user_expected_results') {
    return { update: mockMigrateUpdate }
  }
  // app_settings (default)
  return {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  }
})

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DB_ROW = {
  id: 'settings-uuid',
  prediction_mode: 'shared',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  // Prime the schema-check (limit(0) path)
  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists ? { error: null } : { error: { message: 'relation does not exist' } },
  )

  return new AppSettingsRepository()
}

function setEnvVars() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
}

beforeEach(() => {
  jest.clearAllMocks()
  resetSupabaseServerClient()
  resetSchemaCheckCache()
  resetAppSettingsCache()
})

// ---------------------------------------------------------------------------
// Constructor — env var validation
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – constructor', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    expect(() => new AppSettingsRepository()).toThrow('NEXT_PUBLIC_SUPABASE_URL is required')
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => new AppSettingsRepository()).toThrow('SUPABASE_SERVICE_ROLE_KEY is required')
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })
})

// ---------------------------------------------------------------------------
// verifySchema
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – verifySchema', () => {
  it('proceeds normally when app_settings table exists', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockFindMaybySingle.mockResolvedValueOnce({ data: DB_ROW, error: null })

    const repo = new AppSettingsRepository()
    const result = await repo.find()
    expect(result).not.toBeNull()
  })

  it('throws descriptive error when app_settings table is missing', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: { message: 'relation does not exist' } })

    const repo = new AppSettingsRepository()
    await expect(repo.find()).rejects.toThrow(
      'Supabase table "public.app_settings" does not exist — run pending migrations before starting the application.',
    )
  })

  it('calls the schema check only once across multiple calls on the same instance', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    // Only one data fetch is primed: the second find() is served from the
    // process-scoped settings cache and never reaches the DB.
    mockFindMaybySingle.mockResolvedValueOnce({ data: DB_ROW, error: null })

    const repo = new AppSettingsRepository()
    await repo.find()
    await repo.find()

    expect(mockFindLimit).toHaveBeenCalledWith(0)
    expect(mockSchemaLimit).toHaveBeenCalledTimes(1)
    expect(mockFindMaybySingle).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – find', () => {
  it('returns a mapped AppSettings when a row exists', async () => {
    const repo = makeRepo()
    mockFindMaybySingle.mockResolvedValueOnce({ data: DB_ROW, error: null })

    const result = await repo.find()

    expect(result).toEqual({
      id: 'settings-uuid',
      predictionMode: 'shared',
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
    })
  })

  it('returns null when no row exists', async () => {
    const repo = makeRepo()
    mockFindMaybySingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await repo.find()

    expect(result).toBeNull()
  })

  it('throws "find app_settings failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockFindMaybySingle.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })

    await expect(repo.find()).rejects.toThrow('find app_settings failed: permission denied')
  })
})

// ---------------------------------------------------------------------------
// setPredictionMode
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – setPredictionMode', () => {
  it('calls update with prediction_mode and resolves when a row exists', async () => {
    const repo = makeRepo()
    // update().gt() → success
    mockUpdateGt.mockResolvedValueOnce({ error: null })
    // existence check: .select('id').limit(1).maybySingle() → row found
    mockFindMaybySingle.mockResolvedValueOnce({ data: { id: 'settings-uuid' }, error: null })

    await expect(repo.setPredictionMode('per_quiniela')).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith({ prediction_mode: 'per_quiniela' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('calls insert when no row exists after update (seed missing)', async () => {
    const repo = makeRepo()
    mockUpdateGt.mockResolvedValueOnce({ error: null })
    // existence check: no row found
    mockFindMaybySingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: null })

    await repo.setPredictionMode('shared')

    expect(mockInsert).toHaveBeenCalledWith({ prediction_mode: 'shared' })
  })

  it('throws when update fails', async () => {
    const repo = makeRepo()
    mockUpdateGt.mockResolvedValueOnce({ error: { message: 'update failed' } })

    await expect(repo.setPredictionMode('shared')).rejects.toThrow('setPredictionMode update failed: update failed')
  })

  it('throws when existence check fails', async () => {
    const repo = makeRepo()
    mockUpdateGt.mockResolvedValueOnce({ error: null })
    mockFindMaybySingle.mockResolvedValueOnce({ data: null, error: { message: 'check failed' } })

    await expect(repo.setPredictionMode('shared')).rejects.toThrow('setPredictionMode check failed: check failed')
  })

  it('throws when insert fallback fails', async () => {
    const repo = makeRepo()
    mockUpdateGt.mockResolvedValueOnce({ error: null })
    mockFindMaybySingle.mockResolvedValueOnce({ data: null, error: null })
    mockInsert.mockResolvedValueOnce({ error: { message: 'insert failed' } })

    await expect(repo.setPredictionMode('shared')).rejects.toThrow('setPredictionMode insert failed: insert failed')
  })
})

// ---------------------------------------------------------------------------
// Settings cache — find() caching and write invalidation
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – settings cache', () => {
  it('serves a second find() from the cache without re-querying', async () => {
    const repo = makeRepo()
    mockFindMaybySingle.mockResolvedValueOnce({ data: DB_ROW, error: null })

    const first = await repo.find()
    const second = await repo.find()

    expect(second).toEqual(first)
    expect(mockFindMaybySingle).toHaveBeenCalledTimes(1)
  })

  it('setPredictionMode invalidates the cache so the next find() re-queries', async () => {
    const repo = makeRepo()

    // 1st find: cache miss → DB returns 'shared'
    mockFindMaybySingle.mockResolvedValueOnce({ data: DB_ROW, error: null })
    const before = await repo.find()
    expect(before?.predictionMode).toBe('shared')

    // Write: update succeeds, existence check finds the row
    mockUpdateGt.mockResolvedValueOnce({ error: null })
    mockFindMaybySingle.mockResolvedValueOnce({ data: { id: 'settings-uuid' }, error: null })
    await repo.setPredictionMode('per_quiniela')

    // 2nd find: must hit the DB again and see the new value
    mockFindMaybySingle.mockResolvedValueOnce({
      data: { ...DB_ROW, prediction_mode: 'per_quiniela' },
      error: null,
    })
    const after = await repo.find()

    expect(after?.predictionMode).toBe('per_quiniela')
    expect(mockFindMaybySingle).toHaveBeenCalledTimes(3)
  })
})

// ---------------------------------------------------------------------------
// findOldestQuinielaId
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – findOldestQuinielaId', () => {
  it('returns the quiniela_id of the oldest quiniela with an approved member', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMembershipsMaybeSingle.mockResolvedValueOnce({
      data: { quiniela_id: 'oldest-quiniela-uuid', quinielas: { created_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })

    const result = await repo.findOldestQuinielaId()

    expect(result).toBe('oldest-quiniela-uuid')
  })

  it('returns null when no quiniela has approved members', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMembershipsMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await repo.findOldestQuinielaId()

    expect(result).toBeNull()
  })

  it('throws "findOldestQuinielaId failed: <msg>" on Supabase error', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMembershipsMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    await expect(repo.findOldestQuinielaId()).rejects.toThrow('findOldestQuinielaId failed: DB error')
  })
})

// ---------------------------------------------------------------------------
// migrateSharedPredictions
// ---------------------------------------------------------------------------

describe('AppSettingsRepository – migrateSharedPredictions', () => {
  it('calls update with quiniela_id and IS NULL filter', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMigrateIs.mockResolvedValueOnce({ error: null })

    await repo.migrateSharedPredictions('quiniela-uuid')

    expect(mockMigrateUpdate).toHaveBeenCalledWith({ quiniela_id: 'quiniela-uuid' })
    expect(mockMigrateIs).toHaveBeenCalledWith('quiniela_id', null)
  })

  it('resolves without error when no shared rows exist (no-op)', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMigrateIs.mockResolvedValueOnce({ error: null })

    await expect(repo.migrateSharedPredictions('quiniela-uuid')).resolves.toBeUndefined()
  })

  it('throws "migrateSharedPredictions failed: <msg>" on Supabase error', async () => {
    setEnvVars()
    const repo = new AppSettingsRepository()
    mockMigrateIs.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.migrateSharedPredictions('quiniela-uuid')).rejects.toThrow(
      'migrateSharedPredictions failed: permission denied',
    )
  })
})
