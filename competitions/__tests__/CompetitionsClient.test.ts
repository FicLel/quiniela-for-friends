import { CompetitionsClient } from '../CompetitionsClient'

// ---------------------------------------------------------------------------
// Mock plumbing — global.fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn()
global.fetch = mockFetch

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_STAGE_MATCH = {
  id: 123456,
  utcDate: '2026-06-14T16:00:00Z',
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
  group: 'GROUP_A',
  matchday: 1,
  homeTeam: {
    id: 759,
    name: 'Germany',
    shortName: 'Germany',
    tla: 'GER',
    crest: 'https://crests.football-data.org/759.svg',
  },
  awayTeam: {
    id: 762,
    name: 'Scotland',
    shortName: 'Scotland',
    tla: 'SCO',
    crest: 'https://crests.football-data.org/762.svg',
  },
}

const KNOCKOUT_MATCH = {
  id: 999999,
  utcDate: '2026-07-14T20:00:00Z',
  status: 'SCHEDULED',
  stage: 'ROUND_OF_16',
  group: null,
  matchday: 1,
  homeTeam: {
    id: 759,
    name: 'Germany',
    shortName: 'Germany',
    tla: 'GER',
    crest: 'https://crests.football-data.org/759.svg',
  },
  awayTeam: {
    id: 762,
    name: 'Scotland',
    shortName: 'Scotland',
    tla: 'SCO',
    crest: 'https://crests.football-data.org/762.svg',
  },
}

function makeOkResponse(matches: unknown[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ matches }),
  })
}

function makeErrorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'Unauthorized' }),
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FOOTBALL_DATA_ORG_API_KEY = 'test-api-key'
})

afterEach(() => {
  delete process.env.FOOTBALL_DATA_ORG_API_KEY
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompetitionsClient – fetchGroupStageMatches', () => {
  it('maps a GROUP_STAGE match to a MatchImportRecord correctly', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse([GROUP_STAGE_MATCH]))

    const client = new CompetitionsClient()
    const result = await client.fetchGroupStageMatches()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
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
    })
  })

  it('filters out non-GROUP_STAGE matches', async () => {
    mockFetch.mockReturnValueOnce(
      makeOkResponse([GROUP_STAGE_MATCH, KNOCKOUT_MATCH]),
    )

    const client = new CompetitionsClient()
    const result = await client.fetchGroupStageMatches()

    expect(result).toHaveLength(1)
    expect(result[0].externalId).toBe(123456)
  })

  it('returns an empty array when no GROUP_STAGE matches are present', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse([KNOCKOUT_MATCH]))

    const client = new CompetitionsClient()
    const result = await client.fetchGroupStageMatches()

    expect(result).toEqual([])
  })

  it('handles crest: null gracefully (maps to null)', async () => {
    const matchWithNullCrest = {
      ...GROUP_STAGE_MATCH,
      homeTeam: { ...GROUP_STAGE_MATCH.homeTeam, crest: null },
      awayTeam: { ...GROUP_STAGE_MATCH.awayTeam, crest: null },
    }
    mockFetch.mockReturnValueOnce(makeOkResponse([matchWithNullCrest]))

    const client = new CompetitionsClient()
    const result = await client.fetchGroupStageMatches()

    expect(result[0].homeTeamCrest).toBeNull()
    expect(result[0].awayTeamCrest).toBeNull()
  })

  it('sends the X-Auth-Token header with the API key', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse([GROUP_STAGE_MATCH]))

    const client = new CompetitionsClient()
    await client.fetchGroupStageMatches()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
      expect.objectContaining({
        headers: { 'X-Auth-Token': 'test-api-key' },
      }),
    )
  })

  it('throws when the API returns a non-2xx response', async () => {
    mockFetch.mockReturnValueOnce(makeErrorResponse(401))

    const client = new CompetitionsClient()
    await expect(client.fetchGroupStageMatches()).rejects.toThrow(
      '[CompetitionsClient] Unexpected response from football-data.org: HTTP 401',
    )
  })

  it('throws when fetch rejects (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const client = new CompetitionsClient()
    await expect(client.fetchGroupStageMatches()).rejects.toThrow(
      '[CompetitionsClient] Network failure fetching matches: Network timeout',
    )
  })

  it('throws when FOOTBALL_DATA_ORG_API_KEY env var is missing', async () => {
    delete process.env.FOOTBALL_DATA_ORG_API_KEY

    const client = new CompetitionsClient()
    await expect(client.fetchGroupStageMatches()).rejects.toThrow(
      '[CompetitionsClient] Missing required environment variable: FOOTBALL_DATA_ORG_API_KEY',
    )

    // fetch should NOT have been called — we fail fast before the network call
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
