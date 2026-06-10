import { PlayersRepository } from '../PlayersRepository'
import type { PlayerDbRow } from '../players.types'
import { resetSupabaseServerClient } from '@/lib/supabaseServerClient'
import { resetSchemaCheckCache } from '@/lib/schemaCheckCache'

// ---------------------------------------------------------------------------
// Mock plumbing
//
// Call chains on the Supabase client:
//
//   Schema-check chain:
//     from('players').select('id').limit(0)  → { error }
//
//   upsertPlayers chain:
//     from('players').upsert(rows, opts)  → { error }
//
//   createSyncRun chain:
//     from('sync_runs').insert(data).select().single()  → { data, error }
//
//   updateSyncRun chain:
//     from('sync_runs').update(data).eq('id', id)  → { error }
//
//   createSyncRunItem chain:
//     from('sync_run_items').insert(data)  → { error }
//
//   getActiveSync chain:
//     from('sync_runs').select('*').eq().gte().order().limit().maybeSingle()  → { data }
//
//   getDistinctTeamExternalIds chain:
//     rpc('get_distinct_team_external_ids')  → { data, error }
// ---------------------------------------------------------------------------

// Schema check
const mockSchemaLimit = jest.fn()
const mockSchemaSelectLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  return Promise.resolve({ data: null, error: null })
})

// upsertPlayers
const mockUpsert = jest.fn()

// createSyncRun: .insert(data).select().single()
const mockInsertSingle = jest.fn()
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSingle }))
const mockInsert = jest.fn(() => ({ select: mockInsertSelect }))

// createSyncRunItem: .insert(data) (no chaining after)
const mockItemInsert = jest.fn()

// updateSyncRun: .update(data).eq(field, val)
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))

// getActiveSync: .select('*').eq().gte().order().limit().maybeSingle()
const mockMaybeSingle = jest.fn()
const mockActiveSyncLimit = jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockActiveSyncOrder = jest.fn(() => ({ limit: mockActiveSyncLimit }))
const mockActiveSyncGte = jest.fn(() => ({ order: mockActiveSyncOrder }))
const mockActiveSyncEq = jest.fn(() => ({ gte: mockActiveSyncGte }))

// rpc
const mockRpc = jest.fn()

// findByTeamExternalIds: .select('*').in('team_external_id', ids).order('name')
const mockFindByTeamOrder = jest.fn()  // terminal: .order('name') → Promise<{data, error}>
const mockFindByTeamIn = jest.fn(() => ({ order: mockFindByTeamOrder }))

// Track which table context select('*') is called in
let activeTable = ''

// Combined select: routes on which table is queried via `from`
const mockSelect = jest.fn((arg: string) => {
  if (arg === 'id') return { limit: mockSchemaSelectLimit }
  if (arg === '*') {
    if (activeTable === 'players') {
      // findByTeamExternalIds chain
      return { in: mockFindByTeamIn, eq: mockActiveSyncEq }
    }
    return { eq: mockActiveSyncEq }
  }
  return { limit: mockSchemaSelectLimit }
})

// Router: routes based on table name
const mockFrom = jest.fn((table: string) => {
  activeTable = table
  if (table === 'players') {
    return { select: mockSelect, upsert: mockUpsert }
  }
  if (table === 'sync_runs') {
    return { select: mockSelect, insert: mockInsert, update: mockUpdate }
  }
  if (table === 'sync_run_items') {
    return { insert: mockItemInsert }
  }
  return { select: mockSelect, upsert: mockUpsert, insert: mockInsert, update: mockUpdate }
})

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_ROW: PlayerDbRow = {
  providerPlayerId: 1001,
  teamExternalId: 759,
  name: 'Manuel Neuer',
  position: 'Goalkeeper',
  shirtNumber: 1,
}

const DB_SYNC_RUN_ROW = {
  id: 'sync-run-uuid-1',
  status: 'in_progress',
  started_at: '2026-06-08T00:00:00Z',
  finished_at: null,
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

  return new PlayersRepository()
}

/** Set env vars without priming any schema mock. */
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

describe('PlayersRepository – constructor', () => {
  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    expect(() => new PlayersRepository()).toThrow('NEXT_PUBLIC_SUPABASE_URL is required')

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => new PlayersRepository()).toThrow('SUPABASE_SERVICE_ROLE_KEY is required')

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })
})

// ---------------------------------------------------------------------------
// verifySchema
// ---------------------------------------------------------------------------

describe('PlayersRepository – verifySchema', () => {
  it('proceeds normally when the players table exists', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockUpsert.mockResolvedValueOnce({ error: null })

    const repo = new PlayersRepository()
    const count = await repo.upsertPlayers([])
    expect(count).toBe(0)
  })

  it('throws the descriptive error when limit(0) returns an error', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({
      error: { message: 'relation does not exist' },
    })

    const repo = new PlayersRepository()
    await expect(repo.upsertPlayers([])).rejects.toThrow(
      'Supabase table "public.players" does not exist — run pending migrations before starting the application.',
    )
  })

  it('calls the schema check only once across multiple method calls on the same instance', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockUpsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    const repo = new PlayersRepository()
    await repo.upsertPlayers([])
    await repo.upsertPlayers([])

    expect(mockSchemaSelectLimit).toHaveBeenCalledWith(0)
    expect(mockSchemaSelectLimit).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// upsertPlayers
// ---------------------------------------------------------------------------

describe('PlayersRepository – upsertPlayers', () => {
  it('calls upsert with correct snake_case DB row and returns players length', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const count = await repo.upsertPlayers([PLAYER_ROW])

    expect(count).toBe(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          provider_player_id: 1001,
          team_external_id: 759,
          name: 'Manuel Neuer',
          position: 'Goalkeeper',
          shirt_number: 1,
        },
      ],
      { onConflict: 'provider_player_id', ignoreDuplicates: false },
    )
  })

  it('returns 0 when called with an empty array', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const count = await repo.upsertPlayers([])

    expect(count).toBe(0)
    expect(mockUpsert).toHaveBeenCalledWith([], {
      onConflict: 'provider_player_id',
      ignoreDuplicates: false,
    })
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: { message: 'unique constraint violation' } })

    await expect(repo.upsertPlayers([PLAYER_ROW])).rejects.toThrow(
      'upsertPlayers failed: unique constraint violation',
    )
  })

  it('maps null position and shirtNumber correctly', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    await repo.upsertPlayers([
      { ...PLAYER_ROW, position: null, shirtNumber: null },
    ])

    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ position: null, shirt_number: null })],
      expect.any(Object),
    )
  })

  it('upserts multiple players and returns correct count', async () => {
    const repo = makeRepo()
    mockUpsert.mockResolvedValueOnce({ error: null })

    const player2: PlayerDbRow = {
      providerPlayerId: 1002,
      teamExternalId: 759,
      name: 'Thomas Müller',
      position: 'Midfielder',
      shirtNumber: 25,
    }

    const count = await repo.upsertPlayers([PLAYER_ROW, player2])

    expect(count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// createSyncRun
// ---------------------------------------------------------------------------

describe('PlayersRepository – createSyncRun', () => {
  it('inserts a sync_run with status in_progress and returns a SyncRun domain object', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: DB_SYNC_RUN_ROW, error: null })

    const syncRun = await repo.createSyncRun()

    expect(mockInsert).toHaveBeenCalledWith({ status: 'in_progress' })
    expect(syncRun).toEqual({
      id: 'sync-run-uuid-1',
      status: 'in_progress',
      startedAt: new Date('2026-06-08T00:00:00Z'),
      finishedAt: null,
    })
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'insert failed' },
    })

    await expect(repo.createSyncRun()).rejects.toThrow('createSyncRun failed: insert failed')
  })

  it('maps a non-null finished_at to a Date', async () => {
    const repo = makeRepo()
    const rowWithFinishedAt = {
      ...DB_SYNC_RUN_ROW,
      status: 'completed',
      finished_at: '2026-06-08T01:00:00Z',
    }
    mockInsertSingle.mockResolvedValueOnce({ data: rowWithFinishedAt, error: null })

    const syncRun = await repo.createSyncRun()

    expect(syncRun.finishedAt).toEqual(new Date('2026-06-08T01:00:00Z'))
  })
})

// ---------------------------------------------------------------------------
// updateSyncRun
// ---------------------------------------------------------------------------

describe('PlayersRepository – updateSyncRun', () => {
  it('calls update with correct fields and eq on id', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const finishedAt = new Date('2026-06-08T01:00:00Z')
    await repo.updateSyncRun('sync-run-uuid-1', 'completed', finishedAt)

    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'completed',
      finished_at: finishedAt.toISOString(),
    })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'sync-run-uuid-1')
  })

  it('calls update with status failed', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const finishedAt = new Date('2026-06-08T01:00:00Z')
    await repo.updateSyncRun('sync-run-uuid-1', 'failed', finishedAt)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'update failed' } })

    await expect(
      repo.updateSyncRun('sync-run-uuid-1', 'completed', new Date()),
    ).rejects.toThrow('updateSyncRun failed: update failed')
  })
})

// ---------------------------------------------------------------------------
// createSyncRunItem
// ---------------------------------------------------------------------------

describe('PlayersRepository – createSyncRunItem', () => {
  it('inserts a success item with playersUpserted', async () => {
    const repo = makeRepo()
    mockItemInsert.mockResolvedValueOnce({ error: null })

    await repo.createSyncRunItem({
      syncRunId: 'sync-run-uuid-1',
      teamExternalId: 759,
      status: 'success',
      playersUpserted: 23,
    })

    expect(mockItemInsert).toHaveBeenCalledWith({
      sync_run_id: 'sync-run-uuid-1',
      team_external_id: 759,
      status: 'success',
      players_upserted: 23,
      error_message: null,
    })
  })

  it('inserts an error item with errorMessage', async () => {
    const repo = makeRepo()
    mockItemInsert.mockResolvedValueOnce({ error: null })

    await repo.createSyncRunItem({
      syncRunId: 'sync-run-uuid-1',
      teamExternalId: 762,
      status: 'error',
      errorMessage: 'Team not found',
    })

    expect(mockItemInsert).toHaveBeenCalledWith({
      sync_run_id: 'sync-run-uuid-1',
      team_external_id: 762,
      status: 'error',
      players_upserted: null,
      error_message: 'Team not found',
    })
  })

  it('defaults playersUpserted and errorMessage to null when omitted', async () => {
    const repo = makeRepo()
    mockItemInsert.mockResolvedValueOnce({ error: null })

    await repo.createSyncRunItem({
      syncRunId: 'sync-run-uuid-1',
      teamExternalId: 759,
      status: 'success',
    })

    expect(mockItemInsert).toHaveBeenCalledWith(
      expect.objectContaining({ players_upserted: null, error_message: null }),
    )
  })

  it('throws when Supabase returns an error', async () => {
    const repo = makeRepo()
    mockItemInsert.mockResolvedValueOnce({ error: { message: 'insert failed' } })

    await expect(
      repo.createSyncRunItem({
        syncRunId: 'sync-run-uuid-1',
        teamExternalId: 759,
        status: 'success',
      }),
    ).rejects.toThrow('createSyncRunItem failed: insert failed')
  })
})

// ---------------------------------------------------------------------------
// getActiveSync
// ---------------------------------------------------------------------------

describe('PlayersRepository – getActiveSync', () => {
  it('returns a SyncRun domain object when an active run exists', async () => {
    const repo = makeRepo()
    mockMaybeSingle.mockResolvedValueOnce({ data: DB_SYNC_RUN_ROW })

    const result = await repo.getActiveSync()

    expect(result).toEqual({
      id: 'sync-run-uuid-1',
      status: 'in_progress',
      startedAt: new Date('2026-06-08T00:00:00Z'),
      finishedAt: null,
    })
  })

  it('returns null when no active run exists', async () => {
    const repo = makeRepo()
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    const result = await repo.getActiveSync()

    expect(result).toBeNull()
  })

  it('queries with status = in_progress and gte(started_at, 30-min-ago)', async () => {
    const before = new Date(Date.now() - 30 * 60 * 1000)
    const repo = makeRepo()
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    await repo.getActiveSync()

    const after = new Date(Date.now() - 30 * 60 * 1000)

    expect(mockActiveSyncEq).toHaveBeenCalledWith('status', 'in_progress')
    // gte is called with a timestamp string within our before/after window
    const gteCalls = mockActiveSyncGte.mock.calls as unknown as Array<[string, string]>
    const gteArg = gteCalls[0][1]
    const gteDate = new Date(gteArg)
    expect(gteDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100)
    expect(gteDate.getTime()).toBeLessThanOrEqual(after.getTime() + 100)
  })

  it('calls order(started_at, ascending: false) and limit(1)', async () => {
    const repo = makeRepo()
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    await repo.getActiveSync()

    expect(mockActiveSyncOrder).toHaveBeenCalledWith('started_at', { ascending: false })
    expect(mockActiveSyncLimit).toHaveBeenCalledWith(1)
  })
})

// ---------------------------------------------------------------------------
// getDistinctTeamExternalIds
// ---------------------------------------------------------------------------

describe('PlayersRepository – getDistinctTeamExternalIds', () => {
  it('returns sorted list of team_external_id values from RPC', async () => {
    const repo = makeRepo()
    mockRpc.mockResolvedValueOnce({
      data: [{ team_external_id: 759 }, { team_external_id: 762 }],
      error: null,
    })

    const ids = await repo.getDistinctTeamExternalIds()

    expect(ids).toEqual([759, 762])
    expect(mockRpc).toHaveBeenCalledWith('get_distinct_team_external_ids')
  })

  it('returns empty array when RPC returns empty data', async () => {
    const repo = makeRepo()
    mockRpc.mockResolvedValueOnce({ data: [], error: null })

    const ids = await repo.getDistinctTeamExternalIds()

    expect(ids).toEqual([])
  })

  it('returns empty array when RPC returns null data', async () => {
    const repo = makeRepo()
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const ids = await repo.getDistinctTeamExternalIds()

    expect(ids).toEqual([])
  })

  it('throws when RPC returns an error', async () => {
    const repo = makeRepo()
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'function not found' } })

    await expect(repo.getDistinctTeamExternalIds()).rejects.toThrow(
      'getDistinctTeamExternalIds failed: function not found',
    )
  })
})

// ---------------------------------------------------------------------------
// findByTeamExternalIds
//
// Chain: from('players').select('*').in('team_external_id', ids).order('name')
//   → { data, error }
// ---------------------------------------------------------------------------

describe('PlayersRepository – findByTeamExternalIds', () => {
  const DB_PLAYER_ROW = {
    id: 'player-uuid-1',
    provider_player_id: 1001,
    team_external_id: 759,
    name: 'Manuel Neuer',
    position: 'Goalkeeper',
    shirt_number: 1,
    created_at: '2026-06-08T00:00:00Z',
    updated_at: '2026-06-08T00:00:00Z',
  }

  it('returns [] immediately without querying DB when teamExternalIds is empty', async () => {
    const repo = makeRepo()

    const players = await repo.findByTeamExternalIds([])

    expect(players).toEqual([])
    // verifySchema should NOT have been called (no DB interaction at all)
    expect(mockSchemaLimit).not.toHaveBeenCalled()
    expect(mockFindByTeamIn).not.toHaveBeenCalled()
  })

  it('maps DB rows to Player domain objects', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({ data: [DB_PLAYER_ROW], error: null })

    const players = await repo.findByTeamExternalIds([759])

    expect(players).toHaveLength(1)
    expect(players[0]).toEqual({
      id: 'player-uuid-1',
      providerPlayerId: 1001,
      teamExternalId: 759,
      name: 'Manuel Neuer',
      position: 'Goalkeeper',
      shirtNumber: 1,
      createdAt: new Date('2026-06-08T00:00:00Z'),
      updatedAt: new Date('2026-06-08T00:00:00Z'),
    })
  })

  it('calls .in("team_external_id", ids).order("name")', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({ data: [], error: null })

    await repo.findByTeamExternalIds([759, 762])

    expect(mockFindByTeamIn).toHaveBeenCalledWith('team_external_id', [759, 762])
    expect(mockFindByTeamOrder).toHaveBeenCalledWith('name')
  })

  it('returns [] when data is null', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({ data: null, error: null })

    const players = await repo.findByTeamExternalIds([759])

    expect(players).toEqual([])
  })

  it('returns [] when data is empty', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({ data: [], error: null })

    const players = await repo.findByTeamExternalIds([759])

    expect(players).toEqual([])
  })

  it('throws "findByTeamExternalIds failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({ error: { message: 'permission denied' } })

    await expect(repo.findByTeamExternalIds([759])).rejects.toThrow(
      'findByTeamExternalIds failed: permission denied',
    )
  })

  it('maps null position and shirtNumber to null in Player domain object', async () => {
    const repo = makeRepo()
    mockFindByTeamOrder.mockResolvedValueOnce({
      data: [{ ...DB_PLAYER_ROW, position: null, shirt_number: null }],
      error: null,
    })

    const players = await repo.findByTeamExternalIds([759])

    expect(players[0].position).toBeNull()
    expect(players[0].shirtNumber).toBeNull()
  })
})
