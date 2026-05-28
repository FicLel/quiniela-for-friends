import { CompetitionsRepository } from '../CompetitionsRepository'
import type { MatchImportRecord } from '../competitions.types'

// ---------------------------------------------------------------------------
// Mock plumbing
//
// Call chains on the `matches` table:
//
//   1. Schema-check chain (verifySchema):
//        from('matches').select('id').limit(0)  → { error }
//
//   2. findAllGroupStageMatches chain:
//        from('matches').select('*').order('group').order('matchday').order('scheduled_at')
//        → { data, error }
//
//   3. upsertMatches chain:
//        from('matches').upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false })
//        → { error }
//
// `mockSchemaLimit` terminates the schema-check chain (limit(0) → Promise<{error}>).
// The data-select and upsert chains are routed via `mockFrom` based on the
// chained method calls.
// ---------------------------------------------------------------------------

// Schema-check terminator
const mockSchemaLimit = jest.fn()

// findAllGroupStageMatches: .select('*').order().order().order()
const mockFindOrder3 = jest.fn()
const mockFindOrder2 = jest.fn(() => ({ order: mockFindOrder3 }))
const mockFindOrder1 = jest.fn(() => ({ order: mockFindOrder2 }))

// upsertMatches: .upsert(rows, opts)
const mockUpsert = jest.fn()

// Schema check: .select('id').limit(0) — limit routes on value
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  // fallback (should not be hit in these tests)
  return Promise.resolve({ data: null, error: null })
})

// Combined select: routes on argument
const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockSchemaSelectLimit }
  }
  // arg === '*' → findAllGroupStageMatches chain
  return { order: mockFindOrder1 }
})

// Router
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IMPORT_RECORD: MatchImportRecord = {
  externalId: 123456,
  stage: 'GROUP_STAGE',
  group: 'GROUP_A',
  matchday: 1,
  status: 'SCHEDULED',
  scheduledAt: '2026-06-14T16:00:00Z',
  homeTeamExternalId: 759,
  homeTeamName: 'Germany',
  homeTeamShortName: 'Germany',
  homeTeamTla: 'GER',
  homeTeamCrest: 'https://crests.football-data.org/759.svg',
  awayTeamExternalId: 762,
  awayTeamName: 'Scotland',
  awayTeamShortName: 'Scotland',
  awayTeamTla: 'SCO',
  awayTeamCrest: 'https://crests.football-data.org/762.svg',
}

const DB_ROW = {
  id: 'match-uuid-1',
  external_id: 123456,
  stage: 'GROUP_STAGE',
  group: 'GROUP_A',
  matchday: 1,
  status: 'SCHEDULED',
  scheduled_at: '2026-06-14T16:00:00Z',
  home_team_external_id: 759,
  home_team_name: 'Germany',
  home_team_short_name: 'Germany',
  home_team_tla: 'GER',
  home_team_crest: 'https://crests.football-data.org/759.svg',
  away_team_external_id: 762,
  away_team_name: 'Scotland',
  away_team_short_name: 'Scotland',
  away_team_tla: 'SCO',
  away_team_crest: 'https://crests.football-data.org/762.svg',
  created_at: '2026-05-28T00:00:00Z',
  updated_at: '2026-05-28T00:00:00Z',
}

/**
 * Set env vars, prime the schema-check mock, and return a new repo instance.
 */
function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists
      ? { error: null }
      : { error: { message: 'relation does not exist' } },
  )

  return new CompetitionsRepository()
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

describe('CompetitionsRepository – constructor', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    expect(() => new CompetitionsRepository()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is required',
    )

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => new CompetitionsRepository()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required',
    )

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })
})

// ---------------------------------------------------------------------------
// verifySchema
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – verifySchema', () => {
  it('proceeds normally when the matches table exists', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockFindOrder3.mockResolvedValueOnce({ data: [], error: null })

    const repo = new CompetitionsRepository()
    const result = await repo.findAllGroupStageMatches()
    expect(result).toEqual([])
  })

  it('throws the descriptive error when limit(0) returns an error', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({
      error: { message: 'relation does not exist' },
    })

    const repo = new CompetitionsRepository()
    await expect(repo.findAllGroupStageMatches()).rejects.toThrow(
      'Supabase table "public.matches" does not exist — run pending migrations before starting the application.',
    )
  })

  it('calls the schema check only once across multiple method calls on the same instance', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockFindOrder3
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const repo = new CompetitionsRepository()
    await repo.findAllGroupStageMatches()
    await repo.findAllGroupStageMatches()

    // limit(0) is called exactly once for the schema check.
    expect(mockSchemaSelectLimit).toHaveBeenCalledWith(0)
    expect(mockSchemaSelectLimit).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// upsertMatches
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – upsertMatches', () => {
  it('calls upsert with correct snake_case DB row and returns records length', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const count = await repo.upsertMatches([IMPORT_RECORD])

    expect(count).toBe(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          external_id: 123456,
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          matchday: 1,
          status: 'SCHEDULED',
          scheduled_at: '2026-06-14T16:00:00Z',
          home_team_external_id: 759,
          home_team_name: 'Germany',
          home_team_short_name: 'Germany',
          home_team_tla: 'GER',
          home_team_crest: 'https://crests.football-data.org/759.svg',
          away_team_external_id: 762,
          away_team_name: 'Scotland',
          away_team_short_name: 'Scotland',
          away_team_tla: 'SCO',
          away_team_crest: 'https://crests.football-data.org/762.svg',
        },
      ],
      { onConflict: 'external_id', ignoreDuplicates: false },
    )
  })

  it('returns 0 when called with an empty array', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const count = await repo.upsertMatches([])

    expect(count).toBe(0)
    expect(mockUpsert).toHaveBeenCalledWith([], {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: { message: 'unique constraint violation' } })

    await expect(repo.upsertMatches([IMPORT_RECORD])).rejects.toThrow(
      'upsertMatches failed: unique constraint violation',
    )
  })

  it('maps null crest values correctly in the snake_case row', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    await repo.upsertMatches([
      { ...IMPORT_RECORD, homeTeamCrest: null, awayTeamCrest: null },
    ])

    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ home_team_crest: null, away_team_crest: null })],
      expect.any(Object),
    )
  })
})

// ---------------------------------------------------------------------------
// findAllGroupStageMatches
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – findAllGroupStageMatches', () => {
  it('maps DB rows to Match domain objects', async () => {
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ data: [DB_ROW], error: null })

    const matches = await repo.findAllGroupStageMatches()

    expect(matches).toHaveLength(1)
    expect(matches[0]).toEqual({
      id: 'match-uuid-1',
      externalId: 123456,
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      matchday: 1,
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-06-14T16:00:00Z'),
      homeTeamExternalId: 759,
      homeTeamName: 'Germany',
      homeTeamShortName: 'Germany',
      homeTeamTla: 'GER',
      homeTeamCrest: 'https://crests.football-data.org/759.svg',
      awayTeamExternalId: 762,
      awayTeamName: 'Scotland',
      awayTeamShortName: 'Scotland',
      awayTeamTla: 'SCO',
      awayTeamCrest: 'https://crests.football-data.org/762.svg',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      updatedAt: new Date('2026-05-28T00:00:00Z'),
    })
  })

  it('returns an empty array when no rows exist', async () => {
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ data: [], error: null })

    const matches = await repo.findAllGroupStageMatches()
    expect(matches).toEqual([])
  })

  it('returns an empty array when data is null', async () => {
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ data: null, error: null })

    const matches = await repo.findAllGroupStageMatches()
    expect(matches).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findAllGroupStageMatches()).rejects.toThrow(
      'findAllGroupStageMatches failed: permission denied',
    )
  })

  it('correctly maps null crest values to null in the domain object', async () => {
    const rowWithNullCrests = {
      ...DB_ROW,
      home_team_crest: null,
      away_team_crest: null,
    }
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ data: [rowWithNullCrests], error: null })

    const matches = await repo.findAllGroupStageMatches()

    expect(matches[0].homeTeamCrest).toBeNull()
    expect(matches[0].awayTeamCrest).toBeNull()
  })

  it('calls order chain: group → matchday → scheduled_at', async () => {
    const repo = makeRepo()
    mockFindOrder3.mockResolvedValueOnce({ data: [], error: null })

    await repo.findAllGroupStageMatches()

    expect(mockFindOrder1).toHaveBeenCalledWith('group')
    expect(mockFindOrder2).toHaveBeenCalledWith('matchday')
    expect(mockFindOrder3).toHaveBeenCalledWith('scheduled_at')
  })
})
