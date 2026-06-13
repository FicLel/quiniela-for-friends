/**
 * AuthClient — Infrastructure adapter for custom JWT session management.
 *
 * This is the ONLY file in the codebase that imports from jose or touches
 * session cookies directly. All other modules must depend on this adapter.
 *
 * Session design:
 *   - A signed JWT (HS256) is stored in an HttpOnly cookie named `session`.
 *   - The JWT payload carries: sub (user.id), email, role, mustChangePassword.
 *   - The secret is read from SESSION_SECRET env var (min 32 chars).
 *   - Tokens expire after 7 days.
 *
 * Security notes:
 *   - Password hashing is handled in AuthService (bcryptjs), not here.
 *   - This client only creates/verifies tokens and reads/writes the session cookie.
 *   - Never call this from browser code — Server Actions and proxy.ts only.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export type SessionPayload = {
  sub: string           // user.id (UUID) — the REAL, authenticated user. Never overwritten.
  email: string
  role: 'admin' | 'player'
  mustChangePassword: boolean
  tokenVersion: number
  /**
   * Set when an admin is using "View as User" (read-only impersonation).
   * `sub` / `email` / `role` / `tokenVersion` above continue to represent the
   * real admin — they are never overwritten by impersonation.
   *
   * `undefined` for normal sessions (including tokens issued before this
   * field existed — verifyToken defaults to `undefined` for back-compat).
   */
  impersonating?: {
    userId: string   // impersonated user's id (= effective "viewing as" subject)
    email: string    // impersonated user's email, for the banner
  }
}

/** Result of requireWritableSession — see AuthClient.requireWritableSession. */
export type WritableSessionCheck =
  | { allowed: true }
  | { allowed: false; error: 'IMPERSONATING_READ_ONLY' }

const SESSION_COOKIE_NAME = 'session'
const TOKEN_EXPIRY = '7d'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[AuthClient] Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in the value.`
    )
  }
  return value
}

function getSecretKey(): Uint8Array {
  const secret = requireEnv('SESSION_SECRET')
  if (secret.length < 32) {
    throw new Error(
      '[AuthClient] SESSION_SECRET must be at least 32 characters long.'
    )
  }
  return new TextEncoder().encode(secret)
}

export class AuthClient {
  /**
   * Issue a signed JWT for the given session payload.
   * Returns the compact serialised token string.
   */
  async createToken(payload: SessionPayload): Promise<string> {
    const secret = getSecretKey()
    return new SignJWT({ ...payload } as JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(secret)
  }

  /**
   * Verify a JWT token and return the decoded SessionPayload.
   * Returns null if the token is missing, expired, or has an invalid signature.
   */
  async verifyToken(token: string): Promise<SessionPayload | null> {
    try {
      const secret = getSecretKey()
      const { payload } = await jwtVerify(token, secret)

      const rawImpersonating = payload['impersonating'] as
        | { userId: string; email: string }
        | undefined
        | null

      return {
        sub: payload.sub as string,
        email: payload['email'] as string,
        role: payload['role'] as 'admin' | 'player',
        mustChangePassword: payload['mustChangePassword'] as boolean,
        tokenVersion: (payload['tokenVersion'] as number) ?? 1,
        // Tokens issued before this field existed lack `impersonating` —
        // default to undefined for back-compat.
        impersonating: rawImpersonating ?? undefined,
      }
    } catch {
      return null
    }
  }

  /**
   * Return the user ID whose data should be read.
   *
   * When the session is impersonating another user, returns the impersonated
   * user's ID — this is the single place "which user's data are we reading"
   * is computed. Used by every read path that represents "the viewer's own
   * data" (predictions, membership checks, etc.).
   *
   * Otherwise returns the real authenticated user's ID (`session.sub`).
   */
  getEffectiveUserId(session: SessionPayload): string {
    return session.impersonating?.userId ?? session.sub
  }

  /**
   * Guard for mutation Server Actions / API routes.
   *
   * Blocks ALL writes whenever `session.impersonating` is set — including
   * self-impersonation (admin "viewing as" themselves). This is a single,
   * simple, absolute check with no exceptions: the admin must call
   * `endImpersonation()` to regain write access.
   *
   * Returns `{ allowed: true }` for normal (non-impersonating) sessions, and
   * `{ allowed: false; error: 'IMPERSONATING_READ_ONLY' }` otherwise. Callers
   * map this onto their existing error-result shape (or a 403 for API routes).
   */
  requireWritableSession(session: SessionPayload): WritableSessionCheck {
    if (session.impersonating) {
      return { allowed: false, error: 'IMPERSONATING_READ_ONLY' }
    }
    return { allowed: true }
  }

  /**
   * Serialize a Set-Cookie header value for the session token.
   * HttpOnly + SameSite=Lax + Secure (in production).
   * Suitable for setting on a Server Action response via next/headers cookies().
   */
  buildSessionCookieValue(token: string): {
    name: string
    value: string
    httpOnly: boolean
    sameSite: 'lax'
    secure: boolean
    path: string
    maxAge: number
  } {
    return {
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    }
  }

  /**
   * Build a cookie that clears the session (expired, empty value).
   * Used on sign-out or when a session must be forcibly invalidated.
   */
  buildClearSessionCookieValue(): {
    name: string
    value: string
    httpOnly: boolean
    sameSite: 'lax'
    secure: boolean
    path: string
    maxAge: number
  } {
    return {
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    }
  }

  /**
   * Extract the session cookie value from next/headers cookies().
   * Returns null if the cookie is absent.
   *
   * The cookies() API is async in Next.js 15+.
   * Do NOT use this in proxy.ts — next/headers is unavailable there.
   * Use getTokenFromRequest() for the proxy context.
   */
  async getTokenFromServerAction(): Promise<string | null> {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
  }

  /**
   * Set the session cookie via next/headers cookies().
   * For use inside Server Actions only (not proxy.ts).
   */
  async setSessionCookieOnServerAction(token: string): Promise<void> {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const opts = this.buildSessionCookieValue(token)
    cookieStore.set(opts.name, opts.value, {
      httpOnly: opts.httpOnly,
      sameSite: opts.sameSite,
      secure: opts.secure,
      path: opts.path,
      maxAge: opts.maxAge,
    })
  }

  /**
   * Extract the session token from a NextRequest (proxy/middleware context).
   * Returns null if the cookie is absent.
   */
  getTokenFromRequest(request: { cookies: { get(name: string): { value: string } | undefined } }): string | null {
    return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  }
}
