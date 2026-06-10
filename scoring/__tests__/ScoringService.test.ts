/**
 * Unit tests for ScoringService and the calculateScore pure function.
 *
 * Both IPredictionScoreRepository and ICompetitionsRepository are mocked at
 * the boundary — no real DB queries are made. Tests cover:
 *  - calculateScore pure function (all combinations).
 *  - ScoringService.recalculateMatchScores (happy path, not found, cancelled).
 *  - ScoringService.getCrowdPercentages (happy path, empty, edge percentages).
 */

import { calculateScore, ScoringService } from '../ScoringService'
import type { IPredictionScoreRepository, PredictionWithQuiniela } from '../scoring.types'
import type { ICompetitionsRepository, Match } from '@/competitions/competitions.types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-uuid',
    externalId: 1,
    stage: 'GROUP_STAGE',
    group: 'GROUP_A',
    matchday: 1,
    status: 'FINISHED',
    scheduledAt: new Date('2026-06-14T16:00:00Z'),
    homeTeamExternalId: 1,
    homeTeamName: 'Germany',
    homeTeamShortName: 'Germany',
    homeTeamTla: 'GER',
    homeTeamCrest: null,
    awayTeamExternalId: 2,
    awayTeamName: 'Scotland',
    awayTeamShortName: 'Scotland',
    awayTeamTla: 'SCO',
    awayTeamCrest: null,
    bracketSlot: null,
    matchupDescription: null,
    regulationHomeGoals: 2,
    regulationAwayGoals: 1,
    lastSyncedAt: new Date('2026-06-14T18:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-06-14T18:00:00Z'),
    ...overrides,
  }
}

function makePrediction(overrides: Partial<PredictionWithQuiniela> = {}): PredictionWithQuiniela {
  return {
    predictionId: 'pred-uuid',
    userId: 'user-uuid',
    homeScore: 2,
    awayScore: 1,
    quinielaId: 'quiniela-uuid',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePredictionScoreRepository(
  overrides: Partial<Record<keyof IPredictionScoreRepository, jest.Mock>> = {},
): IPredictionScoreRepository {
  return {
    upsertBatch: jest.fn().mockResolvedValue(undefined),
    findPredictionsWithQuinielas: jest.fn().mockResolvedValue([]),
    aggregateByQuiniela: jest.fn().mockResolvedValue([]),
    findCrowdOutcomes: jest.fn().mockResolvedValue([]),
    findCrowdOutcomesByMatchIds: jest.fn().mockResolvedValue(new Map()),
    ...overrides,
  } as unknown as IPredictionScoreRepository
}

function makeCompetitionsRepository(
  overrides: Partial<Record<keyof ICompetitionsRepository, jest.Mock>> = {},
): ICompetitionsRepository {
  return {
    upsertMatches: jest.fn(),
    findAllGroupStageMatches: jest.fn(),
    findAllMatches: jest.fn(),
    upsertKnockoutPlaceholders: jest.fn(),
    updateKnockoutTeams: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeMatch()),
    updateRegulationResults: jest.fn().mockResolvedValue(undefined),
    findKickoffAt: jest.fn().mockResolvedValue(new Date('2026-06-14T16:00:00Z')),
    ...overrides,
  } as unknown as ICompetitionsRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// calculateScore — pure function tests
// ---------------------------------------------------------------------------

describe('calculateScore', () => {
  it('exact score (2-1 vs 2-1) → totalPoints=3, all points=1', () => {
    const result = calculateScore({ homeScore: 2, awayScore: 1 }, { regulationHomeGoals: 2, regulationAwayGoals: 1 })
    expect(result).toEqual({ homeGoalPoint: 1, awayGoalPoint: 1, outcomePoint: 1, totalPoints: 3 })
  })

  it('correct away goals and correct outcome (2-1 vs 3-1) → homeGoalPoint=0, awayGoalPoint=1, outcomePoint=1, totalPoints=2', () => {
    const result = calculateScore({ homeScore: 2, awayScore: 1 }, { regulationHomeGoals: 3, regulationAwayGoals: 1 })
    expect(result).toEqual({ homeGoalPoint: 0, awayGoalPoint: 1, outcomePoint: 1, totalPoints: 2 })
  })

  it('correct outcome only (1-1 vs 0-0 draw predicted as draw) → homeGoalPoint=0, awayGoalPoint=0, outcomePoint=1, totalPoints=1', () => {
    const result = calculateScore({ homeScore: 1, awayScore: 1 }, { regulationHomeGoals: 0, regulationAwayGoals: 0 })
    expect(result).toEqual({ homeGoalPoint: 0, awayGoalPoint: 0, outcomePoint: 1, totalPoints: 1 })
  })

  it('wrong outcome (1-0 vs 0-1) → all zeros', () => {
    const result = calculateScore({ homeScore: 1, awayScore: 0 }, { regulationHomeGoals: 0, regulationAwayGoals: 1 })
    expect(result).toEqual({ homeGoalPoint: 0, awayGoalPoint: 0, outcomePoint: 0, totalPoints: 0 })
  })

  it('exact score (0-0 vs 0-0) → totalPoints=3', () => {
    const result = calculateScore({ homeScore: 0, awayScore: 0 }, { regulationHomeGoals: 0, regulationAwayGoals: 0 })
    expect(result).toEqual({ homeGoalPoint: 1, awayGoalPoint: 1, outcomePoint: 1, totalPoints: 3 })
  })

  it('exact score home win (2-0 vs 2-0) → totalPoints=3', () => {
    const result = calculateScore({ homeScore: 2, awayScore: 0 }, { regulationHomeGoals: 2, regulationAwayGoals: 0 })
    expect(result).toEqual({ homeGoalPoint: 1, awayGoalPoint: 1, outcomePoint: 1, totalPoints: 3 })
  })

  it('outcome derivation: 1-0 is HOME_WIN → outcome matches', () => {
    const result = calculateScore({ homeScore: 1, awayScore: 0 }, { regulationHomeGoals: 2, regulationAwayGoals: 0 })
    expect(result.outcomePoint).toBe(1)
  })

  it('outcome derivation: 0-0 is DRAW → outcome matches', () => {
    const result = calculateScore({ homeScore: 0, awayScore: 0 }, { regulationHomeGoals: 1, regulationAwayGoals: 1 })
    expect(result.outcomePoint).toBe(1)
  })

  it('outcome derivation: 0-1 is AWAY_WIN → outcome matches', () => {
    const result = calculateScore({ homeScore: 0, awayScore: 1 }, { regulationHomeGoals: 0, regulationAwayGoals: 2 })
    expect(result.outcomePoint).toBe(1)
  })

  it('away goal only correct with wrong outcome → awayGoalPoint=1, outcomePoint=0, totalPoints=1', () => {
    // predict 0-1 (away win), actual 1-1 (draw): away goals match (both 1), outcome does not
    const result = calculateScore({ homeScore: 0, awayScore: 1 }, { regulationHomeGoals: 1, regulationAwayGoals: 1 })
    expect(result).toEqual({ homeGoalPoint: 0, awayGoalPoint: 1, outcomePoint: 0, totalPoints: 1 })
  })
})

// ---------------------------------------------------------------------------
// ScoringService.recalculateMatchScores
// ---------------------------------------------------------------------------

describe('ScoringService.recalculateMatchScores', () => {
  it('fetches the match, gets predictions, calls upsertBatch with correct score breakdown', async () => {
    const match = makeMatch({ regulationHomeGoals: 2, regulationAwayGoals: 1 })
    const prediction = makePrediction({ homeScore: 2, awayScore: 1 })

    const repo = makePredictionScoreRepository({
      findPredictionsWithQuinielas: jest.fn().mockResolvedValue([prediction]),
      upsertBatch: jest.fn().mockResolvedValue(undefined),
    })
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(match),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    expect(compRepo.findById).toHaveBeenCalledWith('match-uuid')
    expect(repo.findPredictionsWithQuinielas).toHaveBeenCalledWith('match-uuid')
    expect(repo.upsertBatch).toHaveBeenCalledWith([
      {
        predictionId: prediction.predictionId,
        quinielaId: prediction.quinielaId,
        homeGoalPoint: 1,
        awayGoalPoint: 1,
        outcomePoint: 1,
        totalPoints: 3,
      },
    ])
  })

  it('returns early (does not upsert) when match is not found', async () => {
    const repo = makePredictionScoreRepository()
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(null),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    expect(repo.findPredictionsWithQuinielas).not.toHaveBeenCalled()
    expect(repo.upsertBatch).not.toHaveBeenCalled()
  })

  it('returns early when match has no regulation goals (null)', async () => {
    const match = makeMatch({ regulationHomeGoals: null, regulationAwayGoals: null })
    const repo = makePredictionScoreRepository()
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(match),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    expect(repo.findPredictionsWithQuinielas).not.toHaveBeenCalled()
    expect(repo.upsertBatch).not.toHaveBeenCalled()
  })

  it('returns early when match status is CANCELLED', async () => {
    const match = makeMatch({ status: 'CANCELLED', regulationHomeGoals: 1, regulationAwayGoals: 0 })
    const repo = makePredictionScoreRepository()
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(match),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    expect(repo.findPredictionsWithQuinielas).not.toHaveBeenCalled()
    expect(repo.upsertBatch).not.toHaveBeenCalled()
  })

  it('calls upsertBatch with empty array when there are no predictions', async () => {
    const match = makeMatch({ regulationHomeGoals: 1, regulationAwayGoals: 0 })
    const repo = makePredictionScoreRepository({
      findPredictionsWithQuinielas: jest.fn().mockResolvedValue([]),
      upsertBatch: jest.fn().mockResolvedValue(undefined),
    })
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(match),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    expect(repo.upsertBatch).toHaveBeenCalledWith([])
  })

  it('scores multiple predictions across different quinielas correctly', async () => {
    const match = makeMatch({ regulationHomeGoals: 1, regulationAwayGoals: 1 })
    const predictions: PredictionWithQuiniela[] = [
      makePrediction({ predictionId: 'pred-1', quinielaId: 'q-1', homeScore: 1, awayScore: 1 }), // exact: 3pts
      makePrediction({ predictionId: 'pred-2', quinielaId: 'q-2', homeScore: 2, awayScore: 2 }), // outcome only (draw): 1pt
      makePrediction({ predictionId: 'pred-3', quinielaId: 'q-1', homeScore: 1, awayScore: 0 }), // home goal right, outcome wrong (1-1 draw but predicted home win): 1pt
    ]

    const repo = makePredictionScoreRepository({
      findPredictionsWithQuinielas: jest.fn().mockResolvedValue(predictions),
      upsertBatch: jest.fn().mockResolvedValue(undefined),
    })
    const compRepo = makeCompetitionsRepository({
      findById: jest.fn().mockResolvedValue(match),
    })

    const service = new ScoringService(repo, compRepo)
    await service.recalculateMatchScores('match-uuid')

    const upsertCalls = (repo.upsertBatch as jest.Mock).mock.calls[0][0]
    expect(upsertCalls).toHaveLength(3)
    expect(upsertCalls[0]).toMatchObject({ predictionId: 'pred-1', totalPoints: 3 })
    expect(upsertCalls[1]).toMatchObject({ predictionId: 'pred-2', totalPoints: 1 })
    // pred-3: home goal correct (1 matches 1), away goal wrong (0 vs 1), outcome wrong (HOME_WIN vs DRAW) → 1pt
    expect(upsertCalls[2]).toMatchObject({ predictionId: 'pred-3', totalPoints: 1 })
  })
})

// ---------------------------------------------------------------------------
// ScoringService.getCrowdPercentages
// ---------------------------------------------------------------------------

describe('ScoringService.getCrowdPercentages', () => {
  it('returns correct percentages for a mix of outcomes', async () => {
    const outcomes = [
      { homeScore: 1, awayScore: 0 }, // HOME_WIN
      { homeScore: 2, awayScore: 0 }, // HOME_WIN
      { homeScore: 0, awayScore: 0 }, // DRAW
      { homeScore: 0, awayScore: 1 }, // AWAY_WIN
    ]
    const repo = makePredictionScoreRepository({
      findCrowdOutcomes: jest.fn().mockResolvedValue(outcomes),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentages('match-uuid')

    expect(result).toEqual({ homeWinPct: 50, drawPct: 25, awayWinPct: 25 })
    expect(repo.findCrowdOutcomes).toHaveBeenCalledWith('match-uuid')
  })

  it('returns 0% for all when there are no crowd predictions', async () => {
    const repo = makePredictionScoreRepository({
      findCrowdOutcomes: jest.fn().mockResolvedValue([]),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentages('match-uuid')

    expect(result).toEqual({ homeWinPct: 0, drawPct: 0, awayWinPct: 0 })
  })

  it('returns 100% homeWinPct when all predictions are home wins', async () => {
    const outcomes = [
      { homeScore: 1, awayScore: 0 },
      { homeScore: 3, awayScore: 1 },
    ]
    const repo = makePredictionScoreRepository({
      findCrowdOutcomes: jest.fn().mockResolvedValue(outcomes),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentages('match-uuid')

    expect(result).toEqual({ homeWinPct: 100, drawPct: 0, awayWinPct: 0 })
  })

  it('rounds percentages to the nearest integer', async () => {
    // 1 home win, 1 draw, 1 away win → each 33.33…%
    const outcomes = [
      { homeScore: 1, awayScore: 0 },
      { homeScore: 0, awayScore: 0 },
      { homeScore: 0, awayScore: 1 },
    ]
    const repo = makePredictionScoreRepository({
      findCrowdOutcomes: jest.fn().mockResolvedValue(outcomes),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentages('match-uuid')

    expect(result.homeWinPct).toBe(33)
    expect(result.drawPct).toBe(33)
    expect(result.awayWinPct).toBe(33)
  })
})

// ---------------------------------------------------------------------------
// ScoringService.getCrowdPercentagesForMatches — batched variant
// ---------------------------------------------------------------------------

describe('ScoringService.getCrowdPercentagesForMatches', () => {
  it('computes percentages per match from a single batched repository call', async () => {
    const outcomesByMatch = new Map([
      [
        'match-1',
        [
          { homeScore: 1, awayScore: 0 }, // HOME_WIN
          { homeScore: 0, awayScore: 0 }, // DRAW
        ],
      ],
      ['match-2', [{ homeScore: 0, awayScore: 2 }]], // AWAY_WIN
    ])
    const repo = makePredictionScoreRepository({
      findCrowdOutcomesByMatchIds: jest.fn().mockResolvedValue(outcomesByMatch),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentagesForMatches(['match-1', 'match-2'])

    expect(repo.findCrowdOutcomesByMatchIds).toHaveBeenCalledTimes(1)
    expect(repo.findCrowdOutcomesByMatchIds).toHaveBeenCalledWith(['match-1', 'match-2'])
    expect(result.get('match-1')).toEqual({ homeWinPct: 50, drawPct: 50, awayWinPct: 0 })
    expect(result.get('match-2')).toEqual({ homeWinPct: 0, drawPct: 0, awayWinPct: 100 })
  })

  it('returns all-zero percentages for matches without predictions (same as single-match)', async () => {
    const repo = makePredictionScoreRepository({
      findCrowdOutcomesByMatchIds: jest.fn().mockResolvedValue(new Map()),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentagesForMatches(['match-1'])

    expect(result.get('match-1')).toEqual({ homeWinPct: 0, drawPct: 0, awayWinPct: 0 })
  })

  it('returns an empty map for an empty match list', async () => {
    const repo = makePredictionScoreRepository()

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const result = await service.getCrowdPercentagesForMatches([])

    expect(result.size).toBe(0)
  })

  it('matches getCrowdPercentages output for the same outcomes', async () => {
    const outcomes = [
      { homeScore: 1, awayScore: 0 },
      { homeScore: 0, awayScore: 0 },
      { homeScore: 0, awayScore: 1 },
    ]
    const repo = makePredictionScoreRepository({
      findCrowdOutcomes: jest.fn().mockResolvedValue(outcomes),
      findCrowdOutcomesByMatchIds: jest.fn().mockResolvedValue(new Map([['match-1', outcomes]])),
    })

    const service = new ScoringService(repo, makeCompetitionsRepository())
    const single = await service.getCrowdPercentages('match-1')
    const batched = await service.getCrowdPercentagesForMatches(['match-1'])

    expect(batched.get('match-1')).toEqual(single)
  })
})
