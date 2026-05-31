/**
 * Unit tests for QuinielasService.
 *
 * IQuinielasRepository is mocked at the boundary — no real DB queries are made.
 * Tests cover business logic only: branching, error mapping, and happy paths.
 */

import { QuinielasService } from '../QuinielasService'
import type { IQuinielasRepository, Quiniela } from '../quinielas.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuiniela(overrides: Partial<Quiniela> = {}): Quiniela {
  return {
    id: 'quiniela-uuid',
    name: 'World Cup 2026',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeRepository(
  overrides: Partial<Record<keyof IQuinielasRepository, jest.Mock>> = {},
): IQuinielasRepository {
  return {
    createWithAdmin: jest.fn().mockResolvedValue(makeQuiniela()),
    findById: jest.fn().mockResolvedValue(makeQuiniela()),
    findAllForUser: jest.fn().mockResolvedValue([makeQuiniela()]),
    ...overrides,
  } as unknown as IQuinielasRepository
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// QuinielasService.createQuiniela
// ---------------------------------------------------------------------------

describe('QuinielasService.createQuiniela', () => {
  it('returns { success: true, quiniela } on happy path', async () => {
    const quiniela = makeQuiniela()
    const repo = makeRepository({
      createWithAdmin: jest.fn().mockResolvedValue(quiniela),
    })
    const service = new QuinielasService(repo)

    const result = await service.createQuiniela({ name: 'World Cup 2026', userId: 'user-uuid' })

    expect(result).toEqual({ success: true, quiniela })
    expect(repo.createWithAdmin).toHaveBeenCalledWith('World Cup 2026', 'user-uuid')
  })

  it('trims the name before calling the repository', async () => {
    const repo = makeRepository()
    const service = new QuinielasService(repo)

    await service.createQuiniela({ name: '  My Quiniela  ', userId: 'user-uuid' })

    expect(repo.createWithAdmin).toHaveBeenCalledWith('My Quiniela', 'user-uuid')
  })

  it('returns NAME_EMPTY for an empty name', async () => {
    const repo = makeRepository()
    const service = new QuinielasService(repo)

    const result = await service.createQuiniela({ name: '', userId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'NAME_EMPTY' })
    expect(repo.createWithAdmin).not.toHaveBeenCalled()
  })

  it('returns NAME_EMPTY for a whitespace-only name', async () => {
    const repo = makeRepository()
    const service = new QuinielasService(repo)

    const result = await service.createQuiniela({ name: '   ', userId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'NAME_EMPTY' })
    expect(repo.createWithAdmin).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when repository.createWithAdmin throws a DB-related error', async () => {
    const repo = makeRepository({
      createWithAdmin: jest.fn().mockRejectedValue(new Error('createWithAdmin RPC failed: constraint')),
    })
    const service = new QuinielasService(repo)

    const result = await service.createQuiniela({ name: 'Test', userId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })

  it('returns DB_ERROR when repository.createWithAdmin throws a sql error', async () => {
    const repo = makeRepository({
      createWithAdmin: jest.fn().mockRejectedValue(new Error('sql error: unique constraint')),
    })
    const service = new QuinielasService(repo)

    const result = await service.createQuiniela({ name: 'Test', userId: 'user-uuid' })

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// QuinielasService.getQuiniela
// ---------------------------------------------------------------------------

describe('QuinielasService.getQuiniela', () => {
  it('returns { success: true, quiniela } when quiniela exists', async () => {
    const quiniela = makeQuiniela()
    const repo = makeRepository({
      findById: jest.fn().mockResolvedValue(quiniela),
    })
    const service = new QuinielasService(repo)

    const result = await service.getQuiniela('quiniela-uuid')

    expect(result).toEqual({ success: true, quiniela })
    expect(repo.findById).toHaveBeenCalledWith('quiniela-uuid')
  })

  it('returns NOT_FOUND when repository returns null', async () => {
    const repo = makeRepository({
      findById: jest.fn().mockResolvedValue(null),
    })
    const service = new QuinielasService(repo)

    const result = await service.getQuiniela('nonexistent-uuid')

    expect(result).toEqual({ success: false, error: 'NOT_FOUND' })
  })

  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const repo = makeRepository({
      findById: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const service = new QuinielasService(repo)

    const result = await service.getQuiniela('quiniela-uuid')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// QuinielasService.listQuinielasForUser
// ---------------------------------------------------------------------------

describe('QuinielasService.listQuinielasForUser', () => {
  it('returns { success: true, quinielas } with the full list', async () => {
    const list = [makeQuiniela(), makeQuiniela({ id: 'quiniela-uuid-2', name: 'Another Quiniela' })]
    const repo = makeRepository({
      findAllForUser: jest.fn().mockResolvedValue(list),
    })
    const service = new QuinielasService(repo)

    const result = await service.listQuinielasForUser('user-uuid')

    expect(result).toEqual({ success: true, quinielas: list })
    expect(repo.findAllForUser).toHaveBeenCalledWith('user-uuid')
  })

  it('returns { success: true, quinielas: [] } for a user with no quinielas', async () => {
    const repo = makeRepository({
      findAllForUser: jest.fn().mockResolvedValue([]),
    })
    const service = new QuinielasService(repo)

    const result = await service.listQuinielasForUser('user-uuid')

    expect(result).toEqual({ success: true, quinielas: [] })
  })

  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const repo = makeRepository({
      findAllForUser: jest.fn().mockRejectedValue(new Error('DB error')),
    })
    const service = new QuinielasService(repo)

    const result = await service.listQuinielasForUser('user-uuid')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})
