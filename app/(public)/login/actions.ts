'use server'

/**
 * actions.ts — Server Functions for the Email + Password login flow.
 *
 * These are the only entry points the frontend should call for auth.
 * They validate inputs, delegate to AuthService, and handle navigation.
 *
 * Import path for the frontend: '@/app/(public)/login/actions'
 */

import { redirect } from 'next/navigation'
import { AuthClient } from '@/auth/AuthClient'
import { AuthService } from '@/auth/AuthService'
import { loginSchema, createFirstAdminSchema } from '@/auth/auth.schemas'
import { UsersRepository } from '@/users/UsersRepository'
import type { LoginResult, CreateFirstAdminResult } from '@/auth/auth.types'

/**
 * Authenticate the user with email + password.
 *
 * Validates inputs first. On validation failure returns INVALID_CREDENTIALS
 * (a malformed email is semantically equivalent to invalid credentials;
 * the UI should validate before calling this action — this is a
 * defence-in-depth guard). On successful authentication, writes the session
 * JWT to an HttpOnly cookie via AuthClient, then redirects to
 * /auth/change-password (if mustChangePassword) or /welcome.
 * On auth failure, returns the typed LoginResult so the UI can show an error.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({ email, password })

  if (!parsed.success) {
    return { success: false, error: 'INVALID_CREDENTIALS' as const }
  }

  const authClient = new AuthClient()
  const usersRepository = new UsersRepository()
  const authService = new AuthService(authClient, usersRepository)

  const result = await authService.login(parsed.data.email, parsed.data.password)

  if (!result.success) {
    return result
  }

  // Write the session token to an HttpOnly cookie.
  await authClient.setSessionCookieOnServerAction(result.token)

  if (result.mustChangePassword) {
    redirect('/auth/change-password')
  }

  redirect('/welcome')
}

/**
 * Create the first admin user during initial application setup.
 *
 * Validates that email is well-formed, password is at least 8 characters, and
 * both password fields match — these checks mirror what the UI enforces, but
 * serve as a server-side defence-in-depth guard.
 *
 * On success, writes the session token to an HttpOnly cookie and redirects the
 * new admin to /auth/change-password (because the first-admin account is
 * always created with mustChangePassword: true).
 *
 * On validation failure or if setup is already complete, returns the typed
 * CreateFirstAdminResult so the UI can display an appropriate error.
 *
 * IMPORTANT: redirect() must not be called inside a try/catch block because
 * Next.js implements redirect() by throwing a special internal error.
 */
export async function createFirstAdmin(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<CreateFirstAdminResult> {
  const parsed = createFirstAdminSchema.safeParse({ email, password, confirmPassword })

  if (!parsed.success) {
    return { success: false, error: 'UNKNOWN_ERROR' as const }
  }

  const authClient = new AuthClient()
  const usersRepository = new UsersRepository()
  const authService = new AuthService(authClient, usersRepository)

  const result = await authService.createFirstAdmin(parsed.data.email, parsed.data.password)

  if (!result.success) {
    return result
  }

  // Write the session token to an HttpOnly cookie.
  await authClient.setSessionCookieOnServerAction(result.token)

  // redirect() throws internally — must NOT be inside a try/catch.
  redirect('/auth/change-password')
}
