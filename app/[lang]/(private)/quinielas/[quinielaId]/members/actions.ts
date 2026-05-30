'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsService } from '@/invitations/InvitationsService'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { MembershipsService } from '@/memberships/MembershipsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { SendInviteResult } from '@/invitations/invitations.types'
import type { RemoveMemberResult, LeaveQuinielaResult, ApproveMemberResult } from '@/memberships/memberships.types'
import type { RevokeInviteResult } from '@/invitations/invitations.types'
import type { Locale } from '@/i18n/i18n.types'

const roleSchema = z.enum(['admin', 'member'])

async function getCallerUserId(): Promise<string | null> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  return session?.sub ?? null
}

/**
 * Generate an open invite link for a quiniela. No email required.
 * Returns result (includes inviteUrl on success).
 */
export async function inviteMember(
  _lang: Locale,
  quinielaId: string,
  roleToAssign: 'admin' | 'member',
): Promise<SendInviteResult> {
  const roleParsed = roleSchema.safeParse(roleToAssign)
  if (!roleParsed.success) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const callerUserId = await getCallerUserId()
  if (!callerUserId) {
    return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const service = new InvitationsService(
    new InvitationsRepository(),
    new MembershipsRepository(),
    new UsersRepository(),
  )

  return service.sendInvite({
    quinielaId,
    roleToAssign: roleParsed.data,
    callerUserId,
    baseUrl,
  })
}

/**
 * Remove a member from a quiniela.
 */
export async function removeMember(
  _lang: Locale,
  quinielaId: string,
  targetMembershipId: string,
): Promise<RemoveMemberResult> {
  const callerUserId = await getCallerUserId()
  if (!callerUserId) {
    return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
  }

  const service = new MembershipsService(new MembershipsRepository())
  return service.removeMember(quinielaId, targetMembershipId, callerUserId)
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvite(
  _lang: Locale,
  quinielaId: string,
  invitationId: string,
): Promise<RevokeInviteResult> {
  const callerUserId = await getCallerUserId()
  if (!callerUserId) {
    return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
  }

  const service = new InvitationsService(
    new InvitationsRepository(),
    new MembershipsRepository(),
    new UsersRepository(),
  )
  return service.revokeInvite(invitationId, quinielaId, callerUserId)
}

/**
 * Approve a pending membership (admin-only).
 * Idempotent — approving an already-approved membership succeeds silently.
 */
export async function approveMember(
  _lang: Locale,
  _quinielaId: string,
  membershipId: string,
): Promise<ApproveMemberResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  if (!session) {
    return { ok: false, error: 'CALLER_NOT_ADMIN' }
  }

  const service = new MembershipsService(new MembershipsRepository())
  return service.approveMember(session.sub, membershipId)
}

/**
 * Leave a quiniela. On success, redirects to /quinielas.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */
export async function leaveQuiniela(
  lang: Locale,
  quinielaId: string,
): Promise<LeaveQuinielaResult> {
  const callerUserId = await getCallerUserId()
  if (!callerUserId) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const service = new MembershipsService(new MembershipsRepository())
  const result = await service.leaveQuiniela(quinielaId, callerUserId)

  if (!result.success) {
    return result
  }

  redirect(`/${lang}/quinielas`)
}
