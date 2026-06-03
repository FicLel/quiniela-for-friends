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

// findAllMatches: .select('*').order('scheduled_at') — single order, terminates
const mockFindAllOrder = jest.fn()

// Controls which chain select('*') routes to.
// false (default) → three-order chain (findAllGroupStageMatches)
// true            → single-order chain (findAllMatches)
let useFindAllChain = false

// upsertMatches: .upsert(rows, opts)
const mockUpsert = jest.fn()

// updateKnockoutTeams select: .select('bracket_slot').eq('stage', s).not('bracket_slot', 'is', null).order(...)
const mockBracketSlotOrder = jest.fn()
const mockBracketSlotNot = jest.fn(() => ({ order: mockBracketSlotOrder }))
const mockBracketSlotEq = jest.fn(() => ({ not: mockBracketSlotNot }))

// updateKnockoutTeams update: .update(data).eq('bracket_slot', slot)
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))

// Schema check: .select('id').limit(0) — limit routes on value
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  // fallback (should not be hit in these tests)
  return Promise.resolve({ data: null, error: null })
})

// Combined select: routes on argument
const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') return { limit: mockSchemaSelectLimit }
  if (arg === 'bracket_slot') return { eq: mockBracketSlotEq }
  // arg === '*' — route based on which method is under test
  if (useFindAllChain) return { order: mockFindAllOrder }
  return { order: mockFindOrder1 }
})

// Router
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
  update: mockUpdate,
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
  bracket_slot: null,
  matchup_description: null,
  created_at: '2026-05-28T00:00:00Z',
  updated_at: '2026-05-28T00:00:00Z',
}

const DB_ROW_KNOCKOUT = {
  id: 'match-uuid-2',
  external_id: 654321,
  stage: 'ROUND_OF_16',
  group: '',
  matchday: 0,
  status: 'SCHEDULED',
  scheduled_at: '2026-07-05T20:00:00Z',
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
  bracket_slot: null,
  matchup_description: null,
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

/**
 * Set useFindAllChain = true, prime the schema-check mock, and return a new
 * repo instance. select('*') will route to the single-order findAllMatches
 * chain for the duration of the test.
 */
function makeRepoForFindAllMatches(schemaExists = true) {
  useFindAllChain = true
  return makeRepo(schemaExists)
}

beforeEach(() => {
  jest.clearAllMocks()
  useFindAllChain = false
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
          bracket_slot: null,
          matchup_description: null,
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
      bracketSlot: null,
      matchupDescription: null,
      regulationHomeGoals: null,
      regulationAwayGoals: null,
      lastSyncedAt: null,
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

// ---------------------------------------------------------------------------
// findAllMatches
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – findAllMatches', () => {
  it('maps mixed GROUP_STAGE and ROUND_OF_16 rows to Match domain objects', async () => {
    const repo = makeRepoForFindAllMatches()
    mockFindAllOrder.mockResolvedValueOnce({
      data: [DB_ROW, DB_ROW_KNOCKOUT],
      error: null,
    })

    const matches = await repo.findAllMatches()

    expect(matches).toHaveLength(2)
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
      bracketSlot: null,
      matchupDescription: null,
      regulationHomeGoals: null,
      regulationAwayGoals: null,
      lastSyncedAt: null,
      createdAt: new Date('2026-05-28T00:00:00Z'),
      updatedAt: new Date('2026-05-28T00:00:00Z'),
    })
    expect(matches[1]).toEqual({
      id: 'match-uuid-2',
      externalId: 654321,
      stage: 'ROUND_OF_16',
      group: '',
      matchday: 0,
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-07-05T20:00:00Z'),
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
      bracketSlot: null,
      matchupDescription: null,
      regulationHomeGoals: null,
      regulationAwayGoals: null,
      lastSyncedAt: null,
      createdAt: new Date('2026-05-28T00:00:00Z'),
      updatedAt: new Date('2026-05-28T00:00:00Z'),
    })
  })

  it('returns an empty array when data is null', async () => {
    const repo = makeRepoForFindAllMatches()
    mockFindAllOrder.mockResolvedValueOnce({ data: null, error: null })

    const matches = await repo.findAllMatches()
    expect(matches).toEqual([])
  })

  it('returns an empty array when data is an empty array', async () => {
    const repo = makeRepoForFindAllMatches()
    mockFindAllOrder.mockResolvedValueOnce({ data: [], error: null })

    const matches = await repo.findAllMatches()
    expect(matches).toEqual([])
  })

  it('calls .select("*").order("scheduled_at") — single order call', async () => {
    const repo = makeRepoForFindAllMatches()
    mockFindAllOrder.mockResolvedValueOnce({ data: [], error: null })

    await repo.findAllMatches()

    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockFindAllOrder).toHaveBeenCalledWith('scheduled_at')
    // The three-order chain mocks must not have been called
    expect(mockFindOrder1).not.toHaveBeenCalled()
    expect(mockFindOrder2).not.toHaveBeenCalled()
    expect(mockFindOrder3).not.toHaveBeenCalled()
  })

  it('throws "findAllMatches failed: <message>" on Supabase error', async () => {
    const repo = makeRepoForFindAllMatches()
    mockFindAllOrder.mockResolvedValueOnce({
      error: { message: 'permission denied' },
    })

    await expect(repo.findAllMatches()).rejects.toThrow(
      'findAllMatches failed: permission denied',
    )
  })

  it('throws the schema-missing error when the matches table does not exist', async () => {
    const repo = makeRepoForFindAllMatches(false)

    await expect(repo.findAllMatches()).rejects.toThrow(
      'Supabase table "public.matches" does not exist — run pending migrations before starting the application.',
    )
  })
})

// ---------------------------------------------------------------------------
// upsertKnockoutPlaceholders
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – upsertKnockoutPlaceholders', () => {
  it('calls upsert with correct snake_case row shape and returns records length', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const placeholderRecord = {
      bracketSlot: 'R32_01',
      matchupDescription: 'Group A Winner vs Group B Runner-up',
      stage: 'ROUND_OF_32',
      matchday: 1,
      scheduledAt: '2026-06-28T20:00:00Z',
      homeTeamName: 'TBD',
      homeTeamShortName: 'TBD',
      homeTeamTla: 'TBD',
      awayTeamName: 'TBD',
      awayTeamShortName: 'TBD',
      awayTeamTla: 'TBD',
    }

    const count = await repo.upsertKnockoutPlaceholders([placeholderRecord])

    expect(count).toBe(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          bracket_slot: 'R32_01',
          matchup_description: 'Group A Winner vs Group B Runner-up',
          stage: 'ROUND_OF_32',
          group: '',
          matchday: 1,
          status: 'SCHEDULED',
          scheduled_at: '2026-06-28T20:00:00Z',
          home_team_name: 'TBD',
          home_team_short_name: 'TBD',
          home_team_tla: 'TBD',
          away_team_name: 'TBD',
          away_team_short_name: 'TBD',
          away_team_tla: 'TBD',
          home_team_crest: null,
          away_team_crest: null,
          external_id: null,
          home_team_external_id: null,
          away_team_external_id: null,
        },
      ],
      { onConflict: 'bracket_slot', ignoreDuplicates: false },
    )
  })

  it('returns 0 when called with an empty array', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const count = await repo.upsertKnockoutPlaceholders([])

    expect(count).toBe(0)
    expect(mockUpsert).toHaveBeenCalledWith([], {
      onConflict: 'bracket_slot',
      ignoreDuplicates: false,
    })
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: { message: 'unique constraint violation' } })

    await expect(
      repo.upsertKnockoutPlaceholders([
        {
          bracketSlot: 'R32_01',
          matchupDescription: 'Group A Winner vs Group B Runner-up',
          stage: 'ROUND_OF_32',
          matchday: 1,
          scheduledAt: '2026-06-28T20:00:00Z',
          homeTeamName: 'TBD',
          homeTeamShortName: 'TBD',
          homeTeamTla: 'TBD',
          awayTeamName: 'TBD',
          awayTeamShortName: 'TBD',
          awayTeamTla: 'TBD',
        },
      ]),
    ).rejects.toThrow('upsertKnockoutPlaceholders failed: unique constraint violation')
  })
})

// ---------------------------------------------------------------------------
// updateKnockoutTeams
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – updateKnockoutTeams', () => {
  const KNOCKOUT_RECORD: import('../competitions.types').MatchImportRecord = {
    externalId: 999,
    stage: 'ROUND_OF_16',
    group: '',
    matchday: 1,
    status: 'IN_PLAY',
    scheduledAt: '2026-07-04T20:00:00Z',
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

  it('fetches bracket_slots for the stage then updates each by bracket_slot, returns count', async () => {
    const repo = makeRepo()
    // First call: select('bracket_slot').eq().not().order() → placeholder list
    mockBracketSlotOrder.mockResolvedValueOnce({ data: [{ bracket_slot: 'R16_01' }], error: null })
    // Second call: update().eq('bracket_slot', 'R16_01')
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const count = await repo.updateKnockoutTeams([KNOCKOUT_RECORD])

    expect(count).toBe(1)
    expect(mockBracketSlotEq).toHaveBeenCalledWith('stage', 'ROUND_OF_16')
    expect(mockBracketSlotNot).toHaveBeenCalledWith('bracket_slot', 'is', null)
    expect(mockBracketSlotOrder).toHaveBeenCalledWith('scheduled_at')
    expect(mockUpdate).toHaveBeenCalledWith({
      external_id: 999,
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
      status: 'IN_PLAY',
    })
    expect(mockUpdateEq).toHaveBeenCalledWith('bracket_slot', 'R16_01')
  })

  it('returns 0 when called with an empty array', async () => {
    const repo = makeRepo()

    const count = await repo.updateKnockoutTeams([])

    expect(count).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockBracketSlotOrder).not.toHaveBeenCalled()
  })

  it('throws when the select (fetch) returns an error', async () => {
    const repo = makeRepo()
    mockBracketSlotOrder.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.updateKnockoutTeams([KNOCKOUT_RECORD])).rejects.toThrow(
      'updateKnockoutTeams failed: permission denied',
    )
  })

  it('throws when the update returns an error', async () => {
    const repo = makeRepo()
    mockBracketSlotOrder.mockResolvedValueOnce({ data: [{ bracket_slot: 'R16_01' }], error: null })
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'update failed' } })

    await expect(repo.updateKnockoutTeams([KNOCKOUT_RECORD])).rejects.toThrow(
      'updateKnockoutTeams failed: update failed',
    )
  })

  it('processes two records in the same stage and returns total count', async () => {
    const repo = makeRepo()
    // Both records are ROUND_OF_16 — one select call returns two placeholders
    mockBracketSlotOrder.mockResolvedValueOnce({
      data: [{ bracket_slot: 'R16_01' }, { bracket_slot: 'R16_02' }],
      error: null,
    })
    mockUpdateEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    const record2 = { ...KNOCKOUT_RECORD, scheduledAt: '2026-07-05T00:00:00Z' }
    const count = await repo.updateKnockoutTeams([KNOCKOUT_RECORD, record2])

    expect(count).toBe(2)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdateEq).toHaveBeenNthCalledWith(1, 'bracket_slot', 'R16_01')
    expect(mockUpdateEq).toHaveBeenNthCalledWith(2, 'bracket_slot', 'R16_02')
  })

  it('skips extra API records when the stage has fewer placeholders than API records', async () => {
    const repo = makeRepo()
    // Only 1 placeholder for ROUND_OF_16, but 2 API records
    mockBracketSlotOrder.mockResolvedValueOnce({
      data: [{ bracket_slot: 'R16_01' }],
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const record2 = { ...KNOCKOUT_RECORD, scheduledAt: '2026-07-05T00:00:00Z' }
    const count = await repo.updateKnockoutTeams([KNOCKOUT_RECORD, record2])

    expect(count).toBe(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// hasAnyMatches
//
// Chain: from('matches').select('id', { count: 'exact', head: true }).limit(1)
//   → { count, error }
//
// The select('id') call routes to { limit: mockSchemaSelectLimit }.
// limit(0) → schema check (consumes first mockResolvedValueOnce from mockSchemaLimit).
// limit(1) → hasAnyMatches result (second mockResolvedValueOnce from mockSchemaSelectLimit).
//
// We prime two values: one for limit(0) via mockSchemaLimit, one for limit(1) directly
// via mockSchemaSelectLimit.
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – hasAnyMatches', () => {
  it('returns true when at least one match exists', async () => {
    setEnvVars()
    // Prime mockSchemaSelectLimit queue in order of calls:
    //   1st call: limit(0) — schema check — delegate to mockSchemaLimit
    //   2nd call: limit(1) — hasAnyMatches data — return { count: 48, error: null }
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSchemaSelectLimit
      .mockImplementationOnce(() => mockSchemaLimit())
      .mockResolvedValueOnce({ count: 48, error: null })

    const repo = new CompetitionsRepository()
    const result = await repo.hasAnyMatches()

    expect(result).toBe(true)
  })

  it('returns false when the matches table is empty (count = 0)', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSchemaSelectLimit
      .mockImplementationOnce(() => mockSchemaLimit())
      .mockResolvedValueOnce({ count: 0, error: null })

    const repo = new CompetitionsRepository()
    const result = await repo.hasAnyMatches()

    expect(result).toBe(false)
  })

  it('returns false when count is null', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSchemaSelectLimit
      .mockImplementationOnce(() => mockSchemaLimit())
      .mockResolvedValueOnce({ count: null, error: null })

    const repo = new CompetitionsRepository()
    const result = await repo.hasAnyMatches()

    expect(result).toBe(false)
  })

  it('throws "hasAnyMatches failed: <msg>" on Supabase error', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSchemaSelectLimit
      .mockImplementationOnce(() => mockSchemaLimit())
      .mockResolvedValueOnce({ count: null, error: { message: 'permission denied' } })

    const repo = new CompetitionsRepository()
    await expect(repo.hasAnyMatches()).rejects.toThrow(
      'hasAnyMatches failed: permission denied',
    )
  })
})

// ---------------------------------------------------------------------------
// findDistinctTeams
//
// Chain: from('matches').select('home_team_name, home_team_external_id, away_team_name, away_team_external_id')
//   → { data, error }   (no further chaining after select)
//
// select('home_team_name, ...') → the default mock branch returns { order: mockFindOrder1 },
// but findDistinctTeams awaits the select directly (no .order() call).
// We need select() to return a Promise for this specific arg.
//
// Strategy: override mockSelect with mockImplementation for the duration of each test,
// calling the schema check path for 'id' and returning a Promise for all other args.
// Use afterEach to restore the default implementation.
// ---------------------------------------------------------------------------

describe('CompetitionsRepository – findDistinctTeams', () => {
  // Dedicated terminal mock for findDistinctTeams data calls
  const mockDistinctTeamsSelect = jest.fn()

  beforeEach(() => {
    // Override mockSelect to handle the team-columns select directly
    mockSelect.mockImplementation((arg: string) => {
      if (arg === 'id') return { limit: mockSchemaSelectLimit }
      if (arg === 'bracket_slot') return { eq: mockBracketSlotEq }
      if (arg === '*') {
        if (useFindAllChain) return { order: mockFindAllOrder }
        return { order: mockFindOrder1 }
      }
      // For any other arg (e.g. team column string): return the terminal mock
      return mockDistinctTeamsSelect()
    })
  })

  afterEach(() => {
    // Restore the original mockSelect implementation after each findDistinctTeams test
    mockSelect.mockImplementation((arg: string) => {
      if (arg === 'id') return { limit: mockSchemaSelectLimit }
      if (arg === 'bracket_slot') return { eq: mockBracketSlotEq }
      if (arg === '*') {
        if (useFindAllChain) return { order: mockFindAllOrder }
        return { order: mockFindOrder1 }
      }
      return { order: mockFindOrder1 }
    })
  })

  it('deduplicates teams by externalId and sorts alphabetically', async () => {
    const repo = makeRepo()
    mockDistinctTeamsSelect.mockReturnValueOnce(Promise.resolve({
      data: [
        { home_team_name: 'Germany', home_team_external_id: 759, away_team_name: 'Scotland', away_team_external_id: 762 },
        { home_team_name: 'Germany', home_team_external_id: 759, away_team_name: 'Hungary', away_team_external_id: 770 },
      ],
      error: null,
    }))

    const teams = await repo.findDistinctTeams()

    expect(teams).toHaveLength(3)
    // Sorted alphabetically
    expect(teams[0].name).toBe('Germany')
    expect(teams[1].name).toBe('Hungary')
    expect(teams[2].name).toBe('Scotland')
  })

  it('returns [] when there are no matches', async () => {
    const repo = makeRepo()
    mockDistinctTeamsSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }))

    const teams = await repo.findDistinctTeams()

    expect(teams).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const repo = makeRepo()
    mockDistinctTeamsSelect.mockReturnValueOnce(Promise.resolve({ data: null, error: null }))

    const teams = await repo.findDistinctTeams()

    expect(teams).toEqual([])
  })

  it('skips rows where team externalId is null', async () => {
    const repo = makeRepo()
    mockDistinctTeamsSelect.mockReturnValueOnce(Promise.resolve({
      data: [
        // home has null externalId → skip home; away is valid
        { home_team_name: 'TBD', home_team_external_id: null, away_team_name: 'France', away_team_external_id: 773 },
      ],
      error: null,
    }))

    const teams = await repo.findDistinctTeams()

    expect(teams).toHaveLength(1)
    expect(teams[0]).toEqual({ name: 'France', externalId: 773 })
  })

  it('throws "findDistinctTeams failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockDistinctTeamsSelect.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'permission denied' } }),
    )

    await expect(repo.findDistinctTeams()).rejects.toThrow(
      'findDistinctTeams failed: permission denied',
    )
  })
})
