/**
 * Unit tests for AuthClient — focused on the admin "View as User"
 * (read-only impersonation) additions:
 *
 * - getEffectiveUserId(session)
 * - requireWritableSession(session)
 * - verifyToken round-trips `impersonating`, with back-compat default of
 *   `undefined` for tokens that never set the field.
 *
 * createToken/verifyToken require SESSION_SECRET (>= 32 chars) — set it here
 * for this test file only.
 *
 * `jose` v6 ships ESM-only (no CJS build), which ts-jest's CommonJS transform
 * cannot load directly. Other test files avoid this by only importing
 * AuthClient's *type* and mocking the class. This file needs the REAL
 * createToken/verifyToken to validate the JWT round-trip, so `jose` is
 * mocked here with a minimal HS256 SignJWT/jwtVerify shim built on Node's
 * built-in `crypto`, matching the subset of the jose API AuthClient uses
 * (setProtectedHeader/setIssuedAt/setExpirationTime/sign, and jwtVerify
 * returning `{ payload }`).
 */

import { createHmac } from 'crypto'

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

jest.mock('jose', () => {
  class SignJWT {
    private payload: Record<string, unknown>
    private header: Record<string, unknown> = {}
    private claims: Record<string, unknown> = {}

    constructor(payload: Record<string, unknown>) {
      this.payload = payload
    }

    setProtectedHeader(header: Record<string, unknown>) {
      this.header = header
      return this
    }

    setIssuedAt() {
      this.claims.iat = Math.floor(Date.now() / 1000)
      return this
    }

    setExpirationTime(exp: string) {
      // Only '7d' is used in this codebase — compute seconds from now.
      const match = /^(\d+)d$/.exec(exp)
      const days = match ? Number(match[1]) : 7
      this.claims.exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60
      return this
    }

    async sign(secret: Uint8Array): Promise<string> {
      const headerB64 = base64url(JSON.stringify({ ...this.header, typ: 'JWT' }))
      const payloadB64 = base64url(JSON.stringify({ ...this.payload, ...this.claims }))
      const signingInput = `${headerB64}.${payloadB64}`
      const signature = createHmac('sha256', Buffer.from(secret)).update(signingInput).digest()
      return `${signingInput}.${base64url(signature)}`
    }
  }

  async function jwtVerify(token: string, secret: Uint8Array): Promise<{ payload: Record<string, unknown> }> {
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid JWT')
    }

    const signingInput = `${headerB64}.${payloadB64}`
    const expectedSignature = createHmac('sha256', Buffer.from(secret)).update(signingInput).digest()
    const actualSignature = base64urlDecode(signatureB64)

    if (!expectedSignature.equals(actualSignature)) {
      throw new Error('signature verification failed')
    }

    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8')) as Record<string, unknown>

    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('token expired')
    }

    return { payload }
  }

  return { SignJWT, jwtVerify }
})

import { AuthClient, type SessionPayload } from '../AuthClient'

const ORIGINAL_ENV = process.env

beforeAll(() => {
  process.env = {
    ...ORIGINAL_ENV,
    SESSION_SECRET: 'a'.repeat(32),
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

function makeSession(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    sub: 'admin-uuid',
    email: 'admin@example.com',
    role: 'admin',
    mustChangePassword: false,
    tokenVersion: 1,
    ...overrides,
  }
}

describe('AuthClient.getEffectiveUserId', () => {
  const authClient = new AuthClient()

  it('returns session.sub for a normal (non-impersonating) session', () => {
    const session = makeSession()
    expect(authClient.getEffectiveUserId(session)).toBe('admin-uuid')
  })

  it('returns the impersonated user id when session.impersonating is set', () => {
    const session = makeSession({
      impersonating: { userId: 'player-uuid', email: 'player@example.com' },
    })
    expect(authClient.getEffectiveUserId(session)).toBe('player-uuid')
  })

  it('returns the admin own id for a self-impersonation session (AC-12)', () => {
    const session = makeSession({
      impersonating: { userId: 'admin-uuid', email: 'admin@example.com' },
    })
    expect(authClient.getEffectiveUserId(session)).toBe('admin-uuid')
  })
})

describe('AuthClient.requireWritableSession', () => {
  const authClient = new AuthClient()

  it('allows writes for a normal (non-impersonating) session', () => {
    const session = makeSession()
    expect(authClient.requireWritableSession(session)).toEqual({ allowed: true })
  })

  it('blocks writes when impersonating another user', () => {
    const session = makeSession({
      impersonating: { userId: 'player-uuid', email: 'player@example.com' },
    })
    expect(authClient.requireWritableSession(session)).toEqual({
      allowed: false,
      error: 'IMPERSONATING_READ_ONLY',
    })
  })

  it('blocks writes even for a self-impersonation session (Decision A — no exception)', () => {
    const session = makeSession({
      impersonating: { userId: 'admin-uuid', email: 'admin@example.com' },
    })
    expect(authClient.requireWritableSession(session)).toEqual({
      allowed: false,
      error: 'IMPERSONATING_READ_ONLY',
    })
  })
})

describe('AuthClient.verifyToken — impersonating round-trip', () => {
  const authClient = new AuthClient()

  it('round-trips a token with impersonating set', async () => {
    const session = makeSession({
      impersonating: { userId: 'player-uuid', email: 'player@example.com' },
    })

    const token = await authClient.createToken(session)
    const decoded = await authClient.verifyToken(token)

    expect(decoded).not.toBeNull()
    expect(decoded?.impersonating).toEqual({ userId: 'player-uuid', email: 'player@example.com' })
  })

  it('round-trips a token without impersonating as undefined', async () => {
    const session = makeSession()

    const token = await authClient.createToken(session)
    const decoded = await authClient.verifyToken(token)

    expect(decoded).not.toBeNull()
    expect(decoded?.impersonating).toBeUndefined()
  })

  it('returns impersonating: undefined when impersonating is explicitly cleared', async () => {
    const session = makeSession({ impersonating: undefined })

    const token = await authClient.createToken(session)
    const decoded = await authClient.verifyToken(token)

    expect(decoded).not.toBeNull()
    expect(decoded?.impersonating).toBeUndefined()
  })
})
