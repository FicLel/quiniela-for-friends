'use server'

/**
 * actions.ts — Server Functions for the forced password-change flow.
 *
 * Called by the Change Password page when the user submits a new password.
 * Validates inputs, confirms the user is authenticated via the session cookie,
 * delegates to AuthService, refreshes the session cookie, and redirects to
 * /welcome on success.
 *
 * Import path for the frontend: '@/app/(private)/auth/change-password/actions'
 */

import { redirect } from 'next/navigation'
import { AuthClient } from '@/auth/AuthClient'
import { AuthService } from '@/auth/AuthService'
import { changePasswordSchema } from '@/auth/auth.schemas'
import { UsersRepository } from '@/users/UsersRepository'
import type { ChangePasswordResult } from '@/auth/auth.types'
import type { Locale } from '@/i18n/i18n.types'

/**
 * Change the current user's password.
 *
 * Validates that newPassword meets the policy (min 8 chars, upper, lower,
 * digit) and that confirmPassword matches. If validation fails, returns a
 * typed error so the UI can display inline messages.
 *
 * Requires the user to have a live session — proxy.ts enforces that only
 * authenticated users can reach this route. If the session cookie is missing
 * or expired by the time the form is submitted, returns UNAUTHORIZED.
 *
 * On success, refreshes the session cookie (with mustChangePassword = false)
 * and redirects to /welcome.
 */
export async function changePassword(
  lang: Locale,
  newPassword: string,
  confirmPassword: string,
): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse({ newPassword, confirmPassword })

  if (!parsed.success) {
    const hasConfirmError = parsed.error.issues.some((issue) =>
      issue.path.includes('confirmPassword'),
    )
    if (hasConfirmError) {
      return { success: false, error: 'PASSWORDS_DO_NOT_MATCH' }
    }
    return { success: false, error: 'POLICY_VIOLATION' }
  }

  const authClient = new AuthClient()

  // Read the current session cookie.
  const token = await authClient.getTokenFromServerAction()
  if (!token) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const session = await authClient.verifyToken(token)
  if (!session) {
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const usersRepository = new UsersRepository()
  const authService = new AuthService(authClient, usersRepository)

  const result = await authService.changePassword(session.sub, parsed.data.newPassword)

  if (!result.success) {
    return result
  }

  // Write the refreshed session token (mustChangePassword = false) to cookie.
  await authClient.setSessionCookieOnServerAction(result.token)

  redirect(`/${lang}/welcome`)
}
