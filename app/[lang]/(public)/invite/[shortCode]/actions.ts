'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsService } from '@/invitations/InvitationsService'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { AcceptInviteResult } from '@/invitations/invitations.types'
import type { Locale } from '@/i18n/i18n.types'

const passwordSchema = z.string().min(8)

function buildInvitationsService() {
  return new InvitationsService(
    new InvitationsRepository(),
    new MembershipsRepository(),
    new UsersRepository(),
  )
}

/**
 * Accept an invitation (via shortCode) when the caller is already logged in.
 *
 * Looks up the invitation by shortCode, then calls acceptInvite with the
 * raw token hash lookup path via the existing service method.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */
export async function acceptInviteAsExistingUser(
  lang: Locale,
  shortCode: string,
): Promise<AcceptInviteResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) return { success: false, error: writable.error }

  // Look up the invitation by short code to get the token hash for acceptInvite
  const invitationsRepo = new InvitationsRepository()
  const invitation = await invitationsRepo.findByShortCode(shortCode)
  if (!invitation) {
    return { success: false, error: 'TOKEN_NOT_FOUND' }
  }

  // acceptInvite requires rawToken to hash and look up — since we already have
  // the invitation, we construct a direct call via the service using the stored tokenHash.
  // We call acceptInvite by passing callerUserId and letting the service validate email match.
  // The service hashes rawToken internally, so we bypass that by using the existing
  // findByTokenHash path. We pass the tokenHash directly as a "pre-hashed" lookup
  // via the service's internal hash mechanism would double-hash. Instead, we call
  // the service with a special path: call acceptInvite for an existing user by
  // directly creating the membership after validation.
  //
  // Cleanest approach: the service's acceptInvite accepts rawToken — we cannot pass
  // tokenHash as rawToken. So we call the service logic directly by calling its
  // repository methods here at the action layer — but that would bypass the service.
  //
  // Correct solution: the service needs a `acceptInviteByShortCode` method, OR
  // the action calls the existing service.acceptInvite with rawToken not available.
  //
  // Resolution per brief OQ-1: "use shortCode directly for invite lookup" — the service
  // `acceptInvite` method uses `findByTokenHash`. We need the service to support
  // shortCode-based acceptance. We add `acceptInviteByShortCode` to the service.
  //
  // However, since the brief says the SERVER ACTION should use findByShortCode and the
  // service already handles the full flow once the invitation is found, the action
  // performs the lookup, validates, and calls the service's internal steps directly
  // via a dedicated service method. To avoid complexity, we delegate back to a new
  // service method `acceptInviteByInvitationId` (not in the brief), or alternatively,
  // we duplicate only the session-check logic here and delegate membership creation
  // to the existing service call pattern.
  //
  // PRACTICAL DECISION: Call `acceptInvite` with the invitation's tokenHash as though
  // it were a raw token — this would fail because the service re-hashes the input.
  // Instead, add a new method to the service specifically for shortCode-based acceptance
  // or handle validation in the action and call repo methods directly (violates arch).
  //
  // FINAL DECISION: The service gains `acceptInviteByShortCode` which mirrors
  // `acceptInvite` but uses `findByShortCode`. This is implemented below via the
  // InvitationsService extension. For now, the action delegates there.
  //
  // SEE: InvitationsService.acceptInviteByShortCode (to be added)

  const service = buildInvitationsService()
  const result = await service.acceptInviteByShortCode({
    shortCode,
    callerUserId: session.sub,
  })

  if (!result.success) {
    return result
  }

  redirect(`/${lang}/welcome`)
}

/**
 * Accept an invitation (via shortCode) as a new user (no active session).
 * Creates the user account, issues a JWT, sets the session cookie.
 *
 * Returns { pendingApproval: true } in the AcceptInviteResult success payload
 * so the page can show the pending state instead of redirecting.
 *
 * IMPORTANT: redirect() is intentionally NOT called here — the page handles
 * the pending state display based on the result.
 */
export async function acceptInviteAsNewUser(
  _lang: Locale,
  shortCode: string,
  email: string,
  password: string,
): Promise<AcceptInviteResult & { pendingApproval?: boolean }> {
  const passwordParsed = passwordSchema.safeParse(password)
  if (!passwordParsed.success) {
    return { success: false, error: 'WEAK_PASSWORD' }
  }

  const service = buildInvitationsService()
  const result = await service.acceptInviteByShortCode({
    shortCode,
    callerUserId: null,
    newPassword: password,
    newUserEmail: email,
  })

  if (!result.success) {
    return result
  }

  // Fetch the newly created user to issue a JWT session cookie
  const usersRepo = new UsersRepository()
  const newUser = await usersRepo.findByEmail(email)
  if (newUser) {
    const authClient = new AuthClient()
    const jwtToken = await authClient.createToken({
      sub: newUser.id,
      email: newUser.email,
      role: 'player',
      mustChangePassword: false,
      tokenVersion: newUser.tokenVersion,
    })
    await authClient.setSessionCookieOnServerAction(jwtToken)
  }

  return { success: true, quinielaId: result.quinielaId, wasNewUser: true, pendingApproval: true }
}
