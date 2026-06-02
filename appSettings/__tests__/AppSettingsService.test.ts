/**
 * Unit tests for AppSettingsService.
 *
 * IAppSettingsRepository is mocked at the boundary — no real DB queries are made.
 * Tests cover business logic only: getSettings, setPredictionMode (shared and
 * per_quiniela paths), backfill trigger, invalid mode guard, and error mapping.
 */

import { AppSettingsService } from '../AppSettingsService'
import type { IAppSettingsRepository, AppSettings, PredictionMode } from '../appSettings.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: 'settings-uuid',
    predictionMode: 'shared',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  }
}

function makeRepository(
  overrides: Partial<Record<keyof IAppSettingsRepository, jest.Mock>> = {},
): IAppSettingsRepository {
  return {
    find: jest.fn().mockResolvedValue(makeAppSettings()),
    setPredictionMode: jest.fn().mockResolvedValue(undefined),
    findOldestQuinielaId: jest.fn().mockResolvedValue(null),
    migrateSharedPredictions: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IAppSettingsRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// AppSettingsService.getSettings
// ---------------------------------------------------------------------------

describe('AppSettingsService.getSettings', () => {
  it('returns the settings when the repository finds a row', async () => {
    const settings = makeAppSettings({ predictionMode: 'shared' })
    const repo = makeRepository({ find: jest.fn().mockResolvedValue(settings) })
    const service = new AppSettingsService(repo)

    const result = await service.getSettings()

    expect(result).toEqual({ success: true, settings })
    expect(repo.find).toHaveBeenCalledTimes(1)
  })

  it('returns NOT_FOUND when the repository returns null', async () => {
    const repo = makeRepository({ find: jest.fn().mockResolvedValue(null) })
    const service = new AppSettingsService(repo)

    const result = await service.getSettings()

    expect(result).toEqual({ success: false, error: 'NOT_FOUND' })
  })

  it('returns UNKNOWN_ERROR when the repository throws', async () => {
    const repo = makeRepository({ find: jest.fn().mockRejectedValue(new Error('DB down')) })
    const service = new AppSettingsService(repo)

    const result = await service.getSettings()

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// AppSettingsService.setPredictionMode — shared path
// ---------------------------------------------------------------------------

describe('AppSettingsService.setPredictionMode — shared', () => {
  it('saves mode and returns { success: true } without touching predictions', async () => {
    const repo = makeRepository()
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('shared')

    expect(result).toEqual({ success: true })
    expect(repo.setPredictionMode).toHaveBeenCalledWith('shared')
    expect(repo.findOldestQuinielaId).not.toHaveBeenCalled()
    expect(repo.migrateSharedPredictions).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when repository.setPredictionMode throws', async () => {
    const repo = makeRepository({
      setPredictionMode: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('shared')

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// AppSettingsService.setPredictionMode — per_quiniela path
// ---------------------------------------------------------------------------

describe('AppSettingsService.setPredictionMode — per_quiniela', () => {
  it('migrates predictions to oldest quiniela and saves mode when quiniela found', async () => {
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockResolvedValue('quiniela-uuid'),
    })
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('per_quiniela')

    expect(result).toEqual({ success: true })
    expect(repo.findOldestQuinielaId).toHaveBeenCalledTimes(1)
    expect(repo.migrateSharedPredictions).toHaveBeenCalledWith('quiniela-uuid')
    expect(repo.setPredictionMode).toHaveBeenCalledWith('per_quiniela')
  })

  it('skips migration (no migrateSharedPredictions call) when no quiniela is found', async () => {
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockResolvedValue(null),
    })
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('per_quiniela')

    expect(result).toEqual({ success: true })
    expect(repo.findOldestQuinielaId).toHaveBeenCalledTimes(1)
    expect(repo.migrateSharedPredictions).not.toHaveBeenCalled()
    expect(repo.setPredictionMode).toHaveBeenCalledWith('per_quiniela')
  })

  it('saves mode even when no quiniela exists', async () => {
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockResolvedValue(null),
    })
    const service = new AppSettingsService(repo)

    await service.setPredictionMode('per_quiniela')

    expect(repo.setPredictionMode).toHaveBeenCalledWith('per_quiniela')
  })

  it('returns DB_ERROR when findOldestQuinielaId throws', async () => {
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('per_quiniela')

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns DB_ERROR when migrateSharedPredictions throws', async () => {
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockResolvedValue('quiniela-uuid'),
      migrateSharedPredictions: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('per_quiniela')

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('migration order: findOldestQuinielaId before migrateSharedPredictions before setPredictionMode', async () => {
    const callOrder: string[] = []
    const repo = makeRepository({
      findOldestQuinielaId: jest.fn().mockImplementation(async () => {
        callOrder.push('findOldestQuinielaId')
        return 'quiniela-uuid'
      }),
      migrateSharedPredictions: jest.fn().mockImplementation(async () => {
        callOrder.push('migrateSharedPredictions')
      }),
      setPredictionMode: jest.fn().mockImplementation(async () => {
        callOrder.push('setPredictionMode')
      }),
    })
    const service = new AppSettingsService(repo)

    await service.setPredictionMode('per_quiniela')

    expect(callOrder).toEqual(['findOldestQuinielaId', 'migrateSharedPredictions', 'setPredictionMode'])
  })
})

// ---------------------------------------------------------------------------
// AppSettingsService.setPredictionMode — invalid mode guard
// ---------------------------------------------------------------------------

describe('AppSettingsService.setPredictionMode — invalid mode', () => {
  it('returns INVALID_MODE for an unrecognised value without calling the repository', async () => {
    const repo = makeRepository()
    const service = new AppSettingsService(repo)

    const result = await service.setPredictionMode('unknown_mode' as PredictionMode)

    expect(result).toEqual({ success: false, error: 'INVALID_MODE' })
    expect(repo.setPredictionMode).not.toHaveBeenCalled()
    expect(repo.findOldestQuinielaId).not.toHaveBeenCalled()
  })
})
