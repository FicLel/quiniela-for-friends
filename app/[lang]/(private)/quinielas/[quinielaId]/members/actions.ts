'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsService } from '@/invitations/InvitationsService'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { MembershipsService } from '@/memberships/MembershipsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { ExpectedResultsService } from '@/expectedResults/ExpectedResultsService'
import { ExpectedResultsRepository } from '@/expectedResults/ExpectedResultsRepository'
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
 * Build an ExpectedResultsService wired to the real infrastructure adapters.
 * Centralised here so both removeMember and leaveQuiniela share the same factory.
 */
function makeExpectedResultsService(membershipsRepository: MembershipsRepository): ExpectedResultsService {
  return new ExpectedResultsService(new ExpectedResultsRepository(), membershipsRepository)
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
 *
 * After successful removal, if the removed user has no remaining memberships,
 * their expected results are deleted via ExpectedResultsService.
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

  const membershipsRepository = new MembershipsRepository()

  // Look up the target membership before removal so we have the userId
  const targetMembership = await membershipsRepository.findById(targetMembershipId)

  const membershipsService = new MembershipsService(membershipsRepository)
  const result = await membershipsService.removeMember(quinielaId, targetMembershipId, callerUserId)

  if (result.success && targetMembership) {
    const remainingCount = await membershipsRepository.countByUser(targetMembership.userId)
    if (remainingCount === 0) {
      await makeExpectedResultsService(membershipsRepository).deleteExpectedResultsForUser(
        targetMembership.userId,
      )
    }
  }

  return result
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
 * After successful leave, if the caller has no remaining memberships,
 * their expected results are deleted via ExpectedResultsService.
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

  const membershipsRepository = new MembershipsRepository()
  const membershipsService = new MembershipsService(membershipsRepository)
  const result = await membershipsService.leaveQuiniela(quinielaId, callerUserId)

  if (!result.success) {
    return result
  }

  const remainingCount = await membershipsRepository.countByUser(callerUserId)
  if (remainingCount === 0) {
    await makeExpectedResultsService(membershipsRepository).deleteExpectedResultsForUser(callerUserId)
  }

  redirect(`/${lang}/quinielas`)
}
