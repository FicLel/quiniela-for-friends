'use server'

import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsService } from '@/invitations/InvitationsService'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { AcceptInviteResult } from '@/invitations/invitations.types'
import type { Locale } from '@/i18n/i18n.types'

const passwordSchema = z.string().min(8)

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function buildInvitationsService() {
  return new InvitationsService(
    new InvitationsRepository(),
    new MembershipsRepository(),
    new UsersRepository(),
  )
}

/**
 * Accept an invitation when the caller is already logged in.
 * On success, redirects to the quiniela.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */
export async function acceptInviteAsExistingUser(
  lang: Locale,
  rawToken: string,
): Promise<AcceptInviteResult> {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const service = buildInvitationsService()
  const result = await service.acceptInvite({ rawToken, callerUserId: session.sub })

  if (!result.success) {
    return result
  }

  redirect(`/${lang}/quinielas/${result.quinielaId}`)
}

/**
 * Accept an invitation as a new user (no active session).
 * Creates the user account, issues a JWT, sets the session cookie, then redirects.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */
export async function acceptInviteAsNewUser(
  lang: Locale,
  rawToken: string,
  password: string,
): Promise<AcceptInviteResult> {
  const passwordParsed = passwordSchema.safeParse(password)
  if (!passwordParsed.success) {
    return { success: false, error: 'WEAK_PASSWORD' }
  }

  // 1. Look up the invitation to get the email (needed for JWT issuance after creation)
  const tokenHash = hashToken(rawToken)
  const invitationsRepo = new InvitationsRepository()
  const invitation = await invitationsRepo.findByTokenHash(tokenHash)
  if (!invitation) {
    return { success: false, error: 'TOKEN_NOT_FOUND' }
  }

  // 2. Call acceptInvite (creates the user)
  const service = buildInvitationsService()
  const result = await service.acceptInvite({
    rawToken,
    callerUserId: null,
    newPassword: password,
  })

  if (!result.success) {
    return result
  }

  // 3. Fetch the newly created user to issue a JWT
  const usersRepo = new UsersRepository()
  const newUser = await usersRepo.findByEmail(invitation.email)
  if (!newUser) {
    // User was created but we can't fetch them — skip cookie and redirect anyway
    redirect(`/${lang}/quinielas/${result.quinielaId}`)
  }

  // 4. Issue JWT and set session cookie
  const authClient = new AuthClient()
  const jwtToken = await authClient.createToken({
    sub: newUser.id,
    email: newUser.email,
    role: 'player',
    mustChangePassword: false,
  })
  await authClient.setSessionCookieOnServerAction(jwtToken)

  redirect(`/${lang}/quinielas/${result.quinielaId}`)
}
