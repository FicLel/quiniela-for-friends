import { UsersRepository } from '../UsersRepository'
import { resetSupabaseServerClient } from '@/lib/supabaseServerClient'
import { resetSchemaCheckCache } from '@/lib/schemaCheckCache'
import * as usersCache from '../usersCache'

// ---------------------------------------------------------------------------
// Mock plumbing
//
// Three call chains on the `users` table:
//
//   1. Schema-check chain (verifySchema):
//        from('users').select('id').limit(0)  → { error }
//
//   2. Data-query chain (findById / findByEmail):
//        from('users').select('*').eq(...).single()
//        from('users').update({}).eq(...)
//
//   3. Insert chain (create):
//        from('users').insert({}).select('*').single()
//
//   4. hasAnyUser chain:
//        from('users').select('id').limit(1).maybeSingle()
//
// `mockLimit` routes on the argument: 0 → schema check, 1 → hasAnyUser.
// ---------------------------------------------------------------------------

// Schema-check terminator: limit(0) → Promise<{ error }>
const mockSchemaLimit = jest.fn()

// Data-query chain (findById / findByEmail)
const mockSingle = jest.fn()
const mockDataSelectEq = jest.fn(() => ({ single: mockSingle }))

// findByIds chain: .select('*').in('id', ids) — terminal
const mockDataSelectIn = jest.fn()

// hasAnyUser chain: .select('id').limit(1).maybeSingle()
const mockHasUsersMaybeSingle = jest.fn()

// Combined limit: routes by argument
const mockLimit = jest.fn((n: number) => {
  if (n === 0) return mockSchemaLimit()
  return { maybeSingle: mockHasUsersMaybeSingle }
})

// Combined select: routes based on the argument
const mockDataSelect = jest.fn((arg: string) => {
  if (arg === 'id') {
    return { limit: mockLimit }
  }
  return { eq: mockDataSelectEq, in: mockDataSelectIn }
})

// Update chain
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))

// Insert chain: .insert({}).select('*').single()
const mockInsertSingle = jest.fn()
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSingle }))
const mockInsert = jest.fn(() => ({ select: mockInsertSelect }))

// Router
const mockFrom = jest.fn(() => ({
  select: mockDataSelect,
  update: mockUpdate,
  insert: mockInsert,
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROW = {
  id: 'user-uuid',
  email: 'player@example.com',
  password_hash: '$2b$12$hashedpassword',
  role: 'player',
  must_change_password: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/**
 * Set env vars, prime the schema-check mock, and return a new repo instance.
 * Must be called before priming mockSingle/mockUpdateEq so the schema mock
 * is enqueued first and consumed by verifySchema before the data mocks are hit.
 */
function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists ? { error: null } : { error: { message: 'relation does not exist' } },
  )

  return new UsersRepository()
}

/** Set env vars without priming any schema mock (useful for verifySchema tests). */
function setEnvVars() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
}

beforeEach(() => {
  jest.clearAllMocks()
  resetSupabaseServerClient()
  resetSchemaCheckCache()
  jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(null)
  jest.spyOn(usersCache, 'setCachedHasUsers').mockImplementation(() => undefined)
})

// ---------------------------------------------------------------------------
// verifySchema
// ---------------------------------------------------------------------------

describe('UsersRepository – verifySchema', () => {
  it('proceeds normally when the table exists', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const repo = new UsersRepository()
    const user = await repo.findByEmail('player@example.com')
    expect(user).not.toBeNull()
  })

  it('throws the descriptive error when limit(0) returns an error', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: { message: 'relation does not exist' } })

    const repo = new UsersRepository()
    await expect(repo.findByEmail('any@example.com')).rejects.toThrow(
      'Supabase table "public.users" does not exist — run pending migrations before starting the application.',
    )
  })

  it('calls the schema check only once across multiple method calls on the same instance', async () => {
    setEnvVars()
    mockSchemaLimit.mockResolvedValueOnce({ error: null })
    mockSingle
      .mockResolvedValueOnce({ data: ROW, error: null })
      .mockResolvedValueOnce({ data: ROW, error: null })

    const repo = new UsersRepository()
    await repo.findByEmail('player@example.com')
    await repo.findById('user-uuid')

    // limit(0) is called exactly once for the schema check.
    expect(mockLimit).toHaveBeenCalledWith(0)
    expect(mockLimit).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// findByEmail
// ---------------------------------------------------------------------------

describe('UsersRepository – findByEmail', () => {
  it('returns a mapped User when a row is found', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const user = await repo.findByEmail('player@example.com')
    expect(user).toEqual({
      id: ROW.id,
      email: ROW.email,
      passwordHash: ROW.password_hash,
      role: ROW.role,
      mustChangePassword: ROW.must_change_password,
      tokenVersion: 1,
      createdAt: new Date(ROW.created_at),
      updatedAt: new Date(ROW.updated_at),
    })
  })

  it('returns null when no row matches', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'No rows found' } })

    const user = await repo.findByEmail('nonexistent@example.com')
    expect(user).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('UsersRepository – findById', () => {
  it('returns a mapped User when a row is found', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const user = await repo.findById('user-uuid')
    expect(user).not.toBeNull()
    expect(user?.id).toBe(ROW.id)
    expect(user?.passwordHash).toBe(ROW.password_hash)
  })

  it('returns null when no row matches', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'No rows found' } })

    const user = await repo.findById('nonexistent')
    expect(user).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// setMustChangePassword
// ---------------------------------------------------------------------------

describe('UsersRepository – setMustChangePassword', () => {
  it('resolves without error on success', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await expect(repo.setMustChangePassword('user-uuid', false)).resolves.toBeUndefined()
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-uuid')
  })

  it('throws when the update returns an error', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'DB error' } })

    await expect(repo.setMustChangePassword('user-uuid', false)).rejects.toThrow(
      'setMustChangePassword failed: DB error',
    )
  })
})

// ---------------------------------------------------------------------------
// setPasswordHash
// ---------------------------------------------------------------------------

describe('UsersRepository – setPasswordHash', () => {
  it('resolves without error on success', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    await expect(repo.setPasswordHash('user-uuid', '$2b$12$newhash')).resolves.toBeUndefined()
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-uuid')
  })

  it('throws when the update returns an error', async () => {
    const repo = makeRepo()
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'DB error' } })

    await expect(repo.setPasswordHash('user-uuid', '$2b$12$newhash')).rejects.toThrow(
      'setPasswordHash failed: DB error',
    )
  })
})

// ---------------------------------------------------------------------------
// findByIds
// ---------------------------------------------------------------------------

describe('UsersRepository – findByIds', () => {
  it('returns [] without querying when ids is empty', async () => {
    setEnvVars()
    const repo = new UsersRepository()

    const users = await repo.findByIds([])

    expect(users).toEqual([])
    expect(mockDataSelectIn).not.toHaveBeenCalled()
    expect(mockSchemaLimit).not.toHaveBeenCalled()
  })

  it('fetches all matching users with a single .in query', async () => {
    const repo = makeRepo()
    const secondRow = { ...ROW, id: 'user-uuid-2', email: 'bob@example.com' }
    mockDataSelectIn.mockResolvedValueOnce({ data: [ROW, secondRow], error: null })

    const users = await repo.findByIds(['user-uuid', 'user-uuid-2'])

    expect(mockDataSelectIn).toHaveBeenCalledTimes(1)
    expect(mockDataSelectIn).toHaveBeenCalledWith('id', ['user-uuid', 'user-uuid-2'])
    expect(users).toHaveLength(2)
    expect(users[0].id).toBe('user-uuid')
    expect(users[1].email).toBe('bob@example.com')
  })

  it('silently omits unknown ids', async () => {
    const repo = makeRepo()
    mockDataSelectIn.mockResolvedValueOnce({ data: [ROW], error: null })

    const users = await repo.findByIds(['user-uuid', 'unknown-uuid'])

    expect(users).toHaveLength(1)
    expect(users[0].id).toBe('user-uuid')
  })

  it('throws "findByIds failed: <msg>" on Supabase error', async () => {
    const repo = makeRepo()
    mockDataSelectIn.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })

    await expect(repo.findByIds(['user-uuid'])).rejects.toThrow('findByIds failed: permission denied')
  })
})

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('UsersRepository – create', () => {
  it('inserts a row and returns the mapped User on success', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const user = await repo.create({
      email: 'player@example.com',
      passwordHash: '$2b$12$hashedpassword',
      role: 'player',
      mustChangePassword: true,
    })

    expect(user).toEqual({
      id: ROW.id,
      email: ROW.email,
      passwordHash: ROW.password_hash,
      role: ROW.role,
      mustChangePassword: ROW.must_change_password,
      tokenVersion: 1,
      createdAt: new Date(ROW.created_at),
      updatedAt: new Date(ROW.updated_at),
    })
    expect(mockInsert).toHaveBeenCalledWith({
      email: 'player@example.com',
      password_hash: '$2b$12$hashedpassword',
      role: 'player',
      must_change_password: true,
    })
  })

  it('sets the hasUsers cache to true after a successful insert', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.create({
      email: 'player@example.com',
      passwordHash: '$2b$12$hashedpassword',
      role: 'player',
      mustChangePassword: true,
    })

    expect(usersCache.setCachedHasUsers).toHaveBeenCalledWith(true)
  })

  it('defaults mustChangePassword to false when not provided', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.create({
      email: 'player@example.com',
      passwordHash: '$2b$12$hashedpassword',
      role: 'admin',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ must_change_password: false }),
    )
  })

  it('throws when the insert returns an error', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'unique constraint' } })

    await expect(
      repo.create({
        email: 'player@example.com',
        passwordHash: '$2b$12$hashedpassword',
        role: 'player',
      }),
    ).rejects.toThrow('create failed: unique constraint')
  })

  it('throws with fallback message when insert returns no data and no error', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: null })

    await expect(
      repo.create({
        email: 'player@example.com',
        passwordHash: '$2b$12$hashedpassword',
        role: 'player',
      }),
    ).rejects.toThrow('create failed: no data returned')
  })
})

// ---------------------------------------------------------------------------
// hasAnyUser
// ---------------------------------------------------------------------------

describe('UsersRepository – hasAnyUser', () => {
  it('returns true immediately (cache hit) without querying the DB', async () => {
    jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(true)
    const repo = makeRepo()

    const result = await repo.hasAnyUser()

    expect(result).toBe(true)
    // The hasAnyUser DB chain should not have been called.
    expect(mockHasUsersMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns true and sets the cache when DB returns a row (cache miss)', async () => {
    jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(null)
    const repo = makeRepo()
    mockHasUsersMaybeSingle.mockResolvedValueOnce({ data: { id: 'user-uuid' }, error: null })

    const result = await repo.hasAnyUser()

    expect(result).toBe(true)
    expect(usersCache.setCachedHasUsers).toHaveBeenCalledWith(true)
  })

  it('returns false and sets the cache when DB returns no row (cache miss)', async () => {
    jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(null)
    const repo = makeRepo()
    mockHasUsersMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await repo.hasAnyUser()

    expect(result).toBe(false)
    expect(usersCache.setCachedHasUsers).toHaveBeenCalledWith(false)
  })

  it('returns false and skips the cache when DB returns false (cache was false)', async () => {
    // Cache already knows no users exist — should still query DB to stay consistent.
    // The implementation only short-circuits on `true`, not `false`.
    jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(false)
    const repo = makeRepo()
    mockHasUsersMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await repo.hasAnyUser()

    expect(result).toBe(false)
  })

  it('throws when the DB query returns an error', async () => {
    jest.spyOn(usersCache, 'getCachedHasUsers').mockReturnValue(null)
    const repo = makeRepo()
    mockHasUsersMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB down' } })

    await expect(repo.hasAnyUser()).rejects.toThrow('hasAnyUser failed: DB down')
  })
})
