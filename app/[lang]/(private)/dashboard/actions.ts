'use server'

import { AuthClient } from '@/auth/AuthClient'
import { UsersService } from '@/users/UsersService'
import { UsersRepository } from '@/users/UsersRepository'
import { MembershipsService } from '@/memberships/MembershipsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { PasswordResetService } from '@/auth/PasswordResetService'
import { PasswordResetRepository } from '@/auth/PasswordResetRepository'
import type { UserListFilters, UserListSort, UserListResult, UserDetailResult } from '@/users/users.types'
import type { ApproveMemberResult } from '@/memberships/memberships.types'
import type { CreateResetTokenResult } from '@/auth/auth.types'
import type { Locale } from '@/i18n/i18n.types'

async function getCallerSession() {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  return session
}

/**
 * List all users (admin-only).
 * Auth-checks the caller's JWT role, then delegates to UsersService.
 */
export async function listUsers(
  _lang: Locale,
  filters: UserListFilters,
  page: number,
  sort: UserListSort,
): Promise<UserListResult> {
  const session = await getCallerSession()
  if (!session) {
    return { ok: false, error: 'NOT_AUTHORIZED' }
  }

  const service = new UsersService(new UsersRepository())
  return service.listAllUsers(session.role, filters, page, sort)
}

/**
 * Approve a pending membership (admin-only).
 * Auth-checks the caller's JWT, then delegates to MembershipsService.
 */
export async function approveMember(
  _lang: Locale,
  membershipId: string,
): Promise<ApproveMemberResult> {
  const session = await getCallerSession()
  if (!session) {
    return { ok: false, error: 'CALLER_NOT_ADMIN' }
  }

  const authClient = new AuthClient()
  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) return { ok: false, error: writable.error }

  const service = new MembershipsService(new MembershipsRepository())
  return service.approveMember(session.sub, membershipId)
}

/**
 * Get a single user with their full memberships detail (admin-only).
 * Auth-checks the caller's JWT role, then delegates to UsersService.
 */
export async function getUserDetail(
  _lang: Locale,
  userId: string,
): Promise<UserDetailResult> {
  const session = await getCallerSession()
  if (!session) {
    return { ok: false, error: 'NOT_AUTHORIZED' }
  }

  const service = new UsersService(new UsersRepository())
  return service.getUserDetail(session.role, userId)
}

/**
 * Generate a single-use password reset link for a target user (admin-only).
 * The link expires in 24 hours and becomes invalid after first use.
 */
export async function generatePasswordResetLink(
  lang: Locale,
  userId: string,
): Promise<CreateResetTokenResult> {
  const session = await getCallerSession()
  if (!session || session.role !== 'admin') {
    return { success: false, error: 'NOT_ADMIN' }
  }

  const authClient = new AuthClient()
  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) return { success: false, error: 'NOT_ADMIN' }

  const { headers } = await import('next/headers')
  const headerStore = await headers()
  const host = headerStore.get('host') ?? 'localhost:3000'
  const proto = headerStore.get('x-forwarded-proto') ??
    (host.includes('localhost') ? 'http' : 'https')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  const service = new PasswordResetService(
    new PasswordResetRepository(),
    new UsersRepository(),
    authClient,
  )

  return service.createResetToken(session.sub, userId, baseUrl, lang)
}
