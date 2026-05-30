/**
 * Unit tests for InvitationsRepository.
 *
 * @supabase/supabase-js is mocked at the module level.
 * Tests cover: findByShortCode (found / not found), create stores shortCode,
 * and findActiveOpenByQuiniela (active open invite / no open invite).
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
//   4. findActiveOpenByQuiniela: from().select('*').eq(...).is(...).is(...).is(...).gt(...).limit(1).single()
//
// ---------------------------------------------------------------------------

// Schema-check terminator
const mockSchemaLimit = jest.fn()

// Single-row terminator (findByTokenHash, findByShortCode, create.single, findActiveOpenByQuiniela)
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

// findActiveOpenByQuiniela chain:
// .select('*').eq('quiniela_id', id).is('email', null).is('accepted_at', null).is('revoked_at', null).gt('expires_at', now).limit(1).single()
const mockOpenSingle = jest.fn()
const mockOpenLimit = jest.fn(() => ({ single: mockOpenSingle }))
const mockOpenGt = jest.fn(() => ({ limit: mockOpenLimit }))
const mockOpenIsRevokedAt = jest.fn(() => ({ gt: mockOpenGt }))
const mockOpenIsAcceptedAt = jest.fn(() => ({ is: mockOpenIsRevokedAt }))
const mockOpenIsEmail = jest.fn(() => ({ is: mockOpenIsAcceptedAt }))
const mockOpenEqQuinela = jest.fn(() => ({ is: mockOpenIsEmail }))

// is/not chains (for findActiveByEmailAndQuiniela)
const mockGt = jest.fn().mockResolvedValue({ data: [], error: null })
const mockIsRevokedAt = jest.fn(() => ({ gt: mockGt }))
const mockIsAcceptedAt = jest.fn(() => ({ is: mockIsRevokedAt }))
const mockEqQuiniela = jest.fn(() => ({ is: mockIsAcceptedAt }))
const mockEqEmail = jest.fn(() => ({ eq: mockEqQuiniela }))
void mockEqEmail // used indirectly via mock router; suppress unused warning

// Router: routes `select` argument to appropriate chain
// We need to handle both data paths, routing based on context.
// For simplicity we use mockDataSelect for 'id' (schema), and a generic eq for '*'.
// The findActiveOpenByQuiniela uses a different chain from eq, so we need to route.

// We'll use a stateful approach: when the eq is called with 'quiniela_id' and the
// next chain has .is(), it means findActiveOpenByQuiniela. We differentiate by
// tracking the call pattern.
let useOpenChain = false

const mockEq = jest.fn((col: string) => {
  if (col === 'quiniela_id' && useOpenChain) {
    return mockOpenEqQuinela()
  }
  return { single: mockSingle }
})

// Override dataSelectEq to use our routing eq
const mockDataSelectWithRouting = jest.fn((arg: string) => {
  if (arg === 'id') return { limit: mockLimit }
  return { eq: mockEq }
})

const mockFrom = jest.fn(() => ({
  select: mockDataSelectWithRouting,
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
  email: null,
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
  useOpenChain = false
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
    expect(result?.email).toBeNull()
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

    expect(mockEq).toHaveBeenCalledWith('short_code', 'ab12cd34')
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
// InvitationsRepository.create — shortCode stored, email nullable
// ---------------------------------------------------------------------------

describe('InvitationsRepository – create stores shortCode', () => {
  it('includes short_code in the INSERT payload', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.create({
      quinielaId: 'quiniela-uuid',
      email: null,
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

  it('inserts email as null for open invites', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    await repo.create({
      quinielaId: 'quiniela-uuid',
      email: null,
      roleToAssign: 'member',
      tokenHash: 'abc123hash',
      shortCode: 'ab12cd34',
      expiresAt: new Date(ROW.expires_at),
      invitedByUserId: 'admin-uuid',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    )
  })

  it('returns an Invitation with shortCode populated from the DB row', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const invitation = await repo.create({
      quinielaId: 'quiniela-uuid',
      email: null,
      roleToAssign: 'member',
      tokenHash: 'abc123hash',
      shortCode: 'ab12cd34',
      expiresAt: new Date(ROW.expires_at),
      invitedByUserId: 'admin-uuid',
    })

    expect(invitation.shortCode).toBe('ab12cd34')
  })

  it('returns an Invitation with email=null for open invites', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const invitation = await repo.create({
      quinielaId: 'quiniela-uuid',
      email: null,
      roleToAssign: 'member',
      tokenHash: 'abc123hash',
      shortCode: 'ab12cd34',
      expiresAt: new Date(ROW.expires_at),
      invitedByUserId: 'admin-uuid',
    })

    expect(invitation.email).toBeNull()
  })

  it('throws when the insert returns an error', async () => {
    const repo = makeRepo()
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'unique constraint' } })

    await expect(
      repo.create({
        quinielaId: 'quiniela-uuid',
        email: null,
        roleToAssign: 'member',
        tokenHash: 'abc123hash',
        shortCode: 'ab12cd34',
        expiresAt: new Date(ROW.expires_at),
        invitedByUserId: 'admin-uuid',
      }),
    ).rejects.toThrow('create invitation failed: unique constraint')
  })
})

// ---------------------------------------------------------------------------
// InvitationsRepository.findActiveOpenByQuiniela
// ---------------------------------------------------------------------------

describe('InvitationsRepository – findActiveOpenByQuiniela', () => {
  it('returns a mapped Invitation when an active open invite exists', async () => {
    useOpenChain = true
    const repo = makeRepo()
    mockOpenSingle.mockResolvedValueOnce({ data: ROW, error: null })

    const result = await repo.findActiveOpenByQuiniela('quiniela-uuid')

    expect(result).not.toBeNull()
    expect(result?.id).toBe(ROW.id)
    expect(result?.email).toBeNull()
    expect(result?.quinielaId).toBe(ROW.quiniela_id)
  })

  it('returns null when no active open invite exists', async () => {
    useOpenChain = true
    const repo = makeRepo()
    mockOpenSingle.mockResolvedValueOnce({ data: null, error: { message: 'No rows found' } })

    const result = await repo.findActiveOpenByQuiniela('quiniela-uuid')

    expect(result).toBeNull()
  })

  it('returns null when the query errors (expired or revoked invites excluded at DB level)', async () => {
    useOpenChain = true
    const repo = makeRepo()
    mockOpenSingle.mockResolvedValueOnce({ data: null, error: { message: 'PGRST116' } })

    const result = await repo.findActiveOpenByQuiniela('quiniela-uuid')

    expect(result).toBeNull()
  })
})
