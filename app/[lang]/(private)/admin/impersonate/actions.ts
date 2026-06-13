'use server'

/**
 * actions.ts — Server Actions for admin "View as User" (read-only impersonation).
 *
 * startImpersonation(email):
 *   - Resolves the real admin session.
 *   - AC-3: rejects with NOT_ADMIN if the caller is not an admin.
 *   - Normalizes the email (trim + lowercase) before lookup.
 *   - Delegates to ImpersonationService.start for AC-2/AC-11/AC-12/AC-13 logic.
 *   - On success, writes a new session token with `impersonating` set and
 *     redirects to /{lang}/welcome.
 *
 * endImpersonation():
 *   - Resolves the real admin session.
 *   - Writes a new session token with `impersonating` cleared and redirects
 *     back to /{lang}/admin/impersonate.
 *   - No DB writes — purely a cookie/token replacement.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */

import { redirect } from 'next/navigation'
import { AuthClient } from '@/auth/AuthClient'
import { ImpersonationService } from '@/impersonation/ImpersonationService'
import { UsersRepository } from '@/users/UsersRepository'
import type { Locale } from '@/i18n/i18n.types'

export type StartImpersonationActionResult =
  | { success: true }
  | {
      success: false
      error: 'NOT_ADMIN' | 'USER_NOT_FOUND' | 'CANNOT_IMPERSONATE_ADMIN' | 'UNKNOWN_ERROR'
    }

export type EndImpersonationActionResult =
  | { success: true }
  | { success: false; error: 'UNKNOWN_ERROR' }

/**
 * Start (or switch) impersonation as the given target email.
 * Redirects to /{lang}/welcome on success.
 */
export async function startImpersonation(
  lang: Locale,
  email: string,
): Promise<StartImpersonationActionResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const normalizedEmail = email.trim().toLowerCase()

  const service = new ImpersonationService(new UsersRepository())
  const result = await service.start(session, normalizedEmail)

  if (!result.success) {
    return result
  }

  const newToken = await authClient.createToken({
    ...session,
    impersonating: result.impersonating,
  })
  await authClient.setSessionCookieOnServerAction(newToken)

  redirect(`/${lang}/welcome`)
}

/**
 * End the current impersonation session, if any.
 * Redirects to /{lang}/admin/impersonate on success.
 */
export async function endImpersonation(lang: Locale): Promise<EndImpersonationActionResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const newToken = await authClient.createToken({
    ...session,
    impersonating: undefined,
  })
  await authClient.setSessionCookieOnServerAction(newToken)

  redirect(`/${lang}/admin/impersonate`)
}
