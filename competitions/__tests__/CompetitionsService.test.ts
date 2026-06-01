import { CompetitionsService } from '../CompetitionsService'
import type {
  ICompetitionsClient,
  ICompetitionsRepository,
  KnockoutPlaceholderRecord,
  Match,
  MatchImportRecord,
} from '../competitions.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MATCH: Match = {
  id: 'uuid-1',
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const RECORD: MatchImportRecord = {
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

// ---------------------------------------------------------------------------
// Helpers — build typed mock objects from jest.fn()
// ---------------------------------------------------------------------------

function makeClient(
  override: Partial<ICompetitionsClient> = {},
): ICompetitionsClient {
  return {
    fetchGroupStageMatches: jest.fn().mockResolvedValue([RECORD]),
    fetchAllKnockoutMatches: jest.fn().mockResolvedValue([RECORD]),
    ...override,
  }
}

function makeRepository(
  override: Partial<ICompetitionsRepository> = {},
): ICompetitionsRepository {
  return {
    upsertMatches: jest.fn().mockResolvedValue(1),
    findAllGroupStageMatches: jest.fn().mockResolvedValue([]),
    findAllMatches: jest.fn().mockResolvedValue([]),
    upsertKnockoutPlaceholders: jest.fn().mockResolvedValue(32),
    updateKnockoutTeams: jest.fn().mockResolvedValue(1),
    findById: jest.fn().mockResolvedValue(null),
    updateRegulationResults: jest.fn().mockResolvedValue(undefined),
    findKickoffAt: jest.fn().mockResolvedValue(null),
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompetitionsService – getAllMatches', () => {
  it('delegates to repository.findAllMatches() and returns its result', async () => {
    const repository = makeRepository({
      findAllMatches: jest.fn().mockResolvedValue([MATCH]),
    })
    const service = new CompetitionsService(makeClient(), repository)

    const result = await service.getAllMatches()

    expect(result).toEqual([MATCH])
    expect(repository.findAllMatches).toHaveBeenCalledTimes(1)
  })

  it('propagates repository errors to the caller without wrapping', async () => {
    const error = new Error('findAllMatches failed: connection refused')
    const repository = makeRepository({
      findAllMatches: jest.fn().mockRejectedValue(error),
    })
    const service = new CompetitionsService(makeClient(), repository)

    await expect(service.getAllMatches()).rejects.toThrow('findAllMatches failed: connection refused')
  })
})

describe('CompetitionsService – importGroupStageMatches', () => {
  it('returns { success: true, count } on happy path', async () => {
    const client = makeClient()
    const repository = makeRepository()
    const service = new CompetitionsService(client, repository)

    const result = await service.importGroupStageMatches()

    expect(result).toEqual({ success: true, count: 1 })
    expect(client.fetchGroupStageMatches).toHaveBeenCalledTimes(1)
    expect(repository.upsertMatches).toHaveBeenCalledWith([RECORD])
  })

  it('returns FETCH_FAILED and does NOT call the repository when client throws', async () => {
    const client = makeClient({
      fetchGroupStageMatches: jest.fn().mockRejectedValue(new Error('Network error')),
    })
    const repository = makeRepository()
    const service = new CompetitionsService(client, repository)

    const result = await service.importGroupStageMatches()

    expect(result).toEqual({ success: false, error: 'FETCH_FAILED' })
    expect(repository.upsertMatches).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when the repository upsert throws', async () => {
    const client = makeClient()
    const repository = makeRepository({
      upsertMatches: jest.fn().mockRejectedValue(new Error('upsertMatches failed: constraint')),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.importGroupStageMatches()

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns { success: true, count: 0 } when client returns an empty array', async () => {
    const client = makeClient({
      fetchGroupStageMatches: jest.fn().mockResolvedValue([]),
    })
    const repository = makeRepository({
      upsertMatches: jest.fn().mockResolvedValue(0),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.importGroupStageMatches()

    expect(result).toEqual({ success: true, count: 0 })
    expect(repository.upsertMatches).toHaveBeenCalledWith([])
  })

  it('returns { success: true, count } equal to the count returned by upsertMatches', async () => {
    const records = [RECORD, { ...RECORD, externalId: 123457 }]
    const client = makeClient({
      fetchGroupStageMatches: jest.fn().mockResolvedValue(records),
    })
    const repository = makeRepository({
      upsertMatches: jest.fn().mockResolvedValue(2),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.importGroupStageMatches()

    expect(result).toEqual({ success: true, count: 2 })
  })
})

// ---------------------------------------------------------------------------
// seedKnockoutPlaceholders
// ---------------------------------------------------------------------------

describe('CompetitionsService – seedKnockoutPlaceholders', () => {
  it('calls repository.upsertKnockoutPlaceholders with 32 records and returns { success: true, count: 32 }', async () => {
    const repository = makeRepository({
      upsertKnockoutPlaceholders: jest.fn().mockResolvedValue(32),
    })
    const service = new CompetitionsService(makeClient(), repository)

    const result = await service.seedKnockoutPlaceholders()

    expect(result).toEqual({ success: true, count: 32 })
    expect(repository.upsertKnockoutPlaceholders).toHaveBeenCalledTimes(1)
    const [calledRecords] = (repository.upsertKnockoutPlaceholders as jest.Mock).mock.calls[0] as [KnockoutPlaceholderRecord[]]
    expect(calledRecords).toHaveLength(32)
  })

  it('first record has bracketSlot R32_01 and last has bracketSlot FINAL_01', async () => {
    const repository = makeRepository({
      upsertKnockoutPlaceholders: jest.fn().mockResolvedValue(32),
    })
    const service = new CompetitionsService(makeClient(), repository)

    await service.seedKnockoutPlaceholders()

    const [calledRecords] = (repository.upsertKnockoutPlaceholders as jest.Mock).mock.calls[0] as [KnockoutPlaceholderRecord[]]
    expect(calledRecords[0].bracketSlot).toBe('R32_01')
    expect(calledRecords[31].bracketSlot).toBe('FINAL_01')
  })

  it('returns { success: false, error: "DB_ERROR" } when repository throws', async () => {
    const repository = makeRepository({
      upsertKnockoutPlaceholders: jest.fn().mockRejectedValue(new Error('upsertKnockoutPlaceholders failed: constraint')),
    })
    const service = new CompetitionsService(makeClient(), repository)

    const result = await service.seedKnockoutPlaceholders()

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('does not call the client', async () => {
    const client = makeClient()
    const service = new CompetitionsService(client, makeRepository())

    await service.seedKnockoutPlaceholders()

    expect(client.fetchGroupStageMatches).not.toHaveBeenCalled()
    expect(client.fetchAllKnockoutMatches).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// syncKnockoutMatches
// ---------------------------------------------------------------------------

describe('CompetitionsService – syncKnockoutMatches', () => {
  it('calls client.fetchAllKnockoutMatches then repository.updateKnockoutTeams and returns success', async () => {
    const client = makeClient({
      fetchAllKnockoutMatches: jest.fn().mockResolvedValue([RECORD]),
    })
    const repository = makeRepository({
      updateKnockoutTeams: jest.fn().mockResolvedValue(1),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.syncKnockoutMatches()

    expect(result).toEqual({ success: true, count: 1 })
    expect(client.fetchAllKnockoutMatches).toHaveBeenCalledTimes(1)
    expect(repository.updateKnockoutTeams).toHaveBeenCalledWith([RECORD])
  })

  it('returns { success: false, error: "FETCH_FAILED" } when client throws', async () => {
    const client = makeClient({
      fetchAllKnockoutMatches: jest.fn().mockRejectedValue(new Error('Network error')),
    })
    const repository = makeRepository()
    const service = new CompetitionsService(client, repository)

    const result = await service.syncKnockoutMatches()

    expect(result).toEqual({ success: false, error: 'FETCH_FAILED' })
    expect(repository.updateKnockoutTeams).not.toHaveBeenCalled()
  })

  it('returns { success: false, error: "DB_ERROR" } when repository throws', async () => {
    const client = makeClient({
      fetchAllKnockoutMatches: jest.fn().mockResolvedValue([RECORD]),
    })
    const repository = makeRepository({
      updateKnockoutTeams: jest.fn().mockRejectedValue(new Error('updateKnockoutTeams failed: constraint')),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.syncKnockoutMatches()

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns { success: true, count: 0 } when client returns empty array', async () => {
    const client = makeClient({
      fetchAllKnockoutMatches: jest.fn().mockResolvedValue([]),
    })
    const repository = makeRepository({
      updateKnockoutTeams: jest.fn().mockResolvedValue(0),
    })
    const service = new CompetitionsService(client, repository)

    const result = await service.syncKnockoutMatches()

    expect(result).toEqual({ success: true, count: 0 })
  })
})
