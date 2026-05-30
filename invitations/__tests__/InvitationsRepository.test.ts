/**
 * Unit tests for InvitationsRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover: findByShortCode (found / not found), and that create stores shortCode.
 * Follows the same mock-chain pattern as UsersRepository.test.ts.
 */

import { InvitationsRepository } from '../InvitationsRepository'

// ---------------------------------------------------------------------------
// Mock plumbing
//
// Query chains on `quiniela_invitations`:
//
//   1. Schema-check:  from('quiniela_invitations').select('id').limit(0) → { error }
//   2. findByShortCode: from().select('*').eq('short_code', sc).single() → { data, error }
//   3. create:        from().insert({}).select('*').single() → { data, error }
//
// ---------------------------------------------------------------------------

// Schema-check terminator
const mockSchemaLimit = jest.fn()

// Single-row terminator (findByTokenHash, findByShortCode, create.single)
const mockSingle = jest.fn()

// eq chained from select('*')
const mockDataSelectEq = jest.fn(() => ({ single: mockSingle }))

// select routing: 'id' → schema check path, '*' → data path
const mockLimit = jest.fn(() => mockSchemaLimit())
const mockDataSelect = jest.fn((arg: string) => {
  if (arg === 'id') return { limit: mockLimit }
  return { eq: mockDataSelectEq }
})

// insert chain: .insert({}).select('*').single()
const mockInsertSingle = jest.fn()
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSingle }))
const mockInsert = jest.fn(() => ({ select: mockInsertSelect }))

// update chain: .update({}).eq(...)
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))

// is/not chains (for findActiveByEmailAndQuiniela)
const mockGt = jest.fn().mockResolvedValue({ data: [], error: null })
const mockIsRevokedAt = jest.fn(() => ({ gt: mockGt }))
const mockIsAcceptedAt = jest.fn(() => ({ is: mockIsRevokedAt }))
const mockEqQuiniela = jest.fn(() => ({ is: mockIsAcceptedAt }))
const mockEqEmail = jest.fn(() => ({ eq: mockEqQuiniela }))
void mockEqEmail // used indirectly via mock router; suppress unused warning

// Router: routes `select` argument to appropriate chain
const mockFrom = jest.fn(() => ({
  select: mockDataSelect,
  insert: mockInsert,
  update: mockUpdate,
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROW = {
  id: 'invitation-uuid',
  quiniela_id: 'quiniela-uuid',
  email: 'invited@example.com',
  role_to_assign: 'member',
  token_hash: 'abc123hash',
  short_code: 'ab12cd34',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  accepted_at: null,
  revoked_at: null,
  invited_by_user_id: 'admin-uuid',
  created_at: '2026-01-01T00:00:00Z',
}

function makeRepo(schemaExists = true) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockSchemaLimit.mockResolvedValueOnce(
    schemaExists ? { error: null } : { error: { message: 'relation does not exist' } },
  )

  return new InvitationsRepository()
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// InvitationsRepository.findByShortCode
// ---------------------------------------------------------------------------

describe('InvitationsRepository – findByShortCode', () => {
  it('returns a mapped Invitation when a row is found', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const result = await repo.findByShortCode('ab12cd34')

    expect(result).not.toBeNull()
    expect(result?.id).toBe(ROW.id)
    expect(result?.shortCode).toBe(ROW.short_code)
    expect(result?.quinielaId).toBe(ROW.quiniela_id)
    expect(result?.email).toBe(ROW.email)
    expect(result?.roleToAssign).toBe(ROW.role_to_assign)
    expect(result?.tokenHash).toBe(ROW.token_hash)
    expect(result?.acceptedAt).toBeNull()
    expect(result?.revokedAt).toBeNull()
  })

  it('returns null when no row matches the shortCode', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'No rows found' } })

    const result = await repo.findByShortCode('notfound')

    expect(result).toBeNull()
  })

  it('queries the correct column (short_code)', async () => {
    const repo = makeRepo()
    mockSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.findByShortCode('ab12cd34')

    expect(mockDataSelectEq).toHaveBeenCalledWith('short_code', 'ab12cd34')
  })

  it('maps accepted_at and revoked_at as Date objects when present', async () => {
    const repo = makeRepo()
    const rowWithDates = {
      ...ROW,
      accepted_at: '2026-02-01T00:00:00Z',
      revoked_at: '2026-02-02T00:00:00Z',
    }
    mockSingle.mockResolvedValueOnce({ data: rowWithDates, error: null })

    const result = await repo.findByShortCode('ab12cd34')

    expect(result?.acceptedAt).toEqual(new Date('2026-02-01T00:00:00Z'))
    expect(result?.revokedAt).toEqual(new Date('2026-02-02T00:00:00Z'))
  })
})

// ---------------------------------------------------------------------------
// InvitationsRepository.create — shortCode stored
// ---------------------------------------------------------------------------

describe('InvitationsRepository – create stores shortCode', () => {
  it('includes short_code in the INSERT payload', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.create({
      quinielaId: 'quiniela-uuid',
      email: 'invited@example.com',
      roleToAssign: 'member',
      tokenHash: 'abc123hash',
      shortCode: 'ab12cd34',
      expiresAt: new Date(ROW.expires_at),
      invitedByUserId: 'admin-uuid',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ short_code: 'ab12cd34' }),
    )
  })

  it('returns an Invitation with shortCode populated from the DB row', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const invitation = await repo.create({
      quinielaId: 'quiniela-uuid',
      email: 'invited@example.com',
      roleToAssign: 'member',
      tokenHash: 'abc123hash',
      shortCode: 'ab12cd34',
      expiresAt: new Date(ROW.expires_at),
      invitedByUserId: 'admin-uuid',
    })

    expect(invitation.shortCode).toBe('ab12cd34')
  })

  it('throws when the insert returns an error', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'unique constraint' } })

    await expect(
      repo.create({
        quinielaId: 'quiniela-uuid',
        email: 'invited@example.com',
        roleToAssign: 'member',
        tokenHash: 'abc123hash',
        shortCode: 'ab12cd34',
        expiresAt: new Date(ROW.expires_at),
        invitedByUserId: 'admin-uuid',
      }),
    ).rejects.toThrow('create invitation failed: unique constraint')
  })
})
