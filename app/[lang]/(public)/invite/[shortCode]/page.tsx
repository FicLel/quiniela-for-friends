import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { Locale } from '@/i18n/i18n.types'
import InviteAcceptanceFlow, { type PageData } from './_components/InviteAcceptanceFlow'
import { acceptInviteAsExistingUser, acceptInviteAsNewUser } from './actions'

type PageProps = {
  params: Promise<{ lang: string; shortCode: string }>
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@')
  if (atIdx <= 0) return email
  return `${email[0]}***${email.slice(atIdx)}`
}

export default async function InvitePage({ params }: PageProps) {
  const { lang, shortCode } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  // Read the invitation from the DB by shortCode
  const invitationsRepo = new InvitationsRepository()
  const invitation = await invitationsRepo.findByShortCode(shortCode)

  let pageData: PageData

  if (!invitation) {
    pageData = { status: 'invalid', reason: 'NOT_FOUND' }
  } else if (invitation.acceptedAt !== null) {
    pageData = { status: 'invalid', reason: 'ALREADY_ACCEPTED' }
  } else if (invitation.revokedAt !== null) {
    pageData = { status: 'invalid', reason: 'REVOKED' }
  } else if (invitation.expiresAt < new Date()) {
    pageData = { status: 'invalid', reason: 'EXPIRED' }
  } else {
    // Invitation is valid — check session
    const authClient = new AuthClient()
    const sessionToken = await authClient.getTokenFromServerAction()
    const session = sessionToken ? await authClient.verifyToken(sessionToken) : null

    const hasSession = session !== null
    const sessionEmailMatches =
      hasSession &&
      session!.email.toLowerCase() === invitation.email.toLowerCase()

    // Check if the invited user already has an account
    const usersRepo = new UsersRepository()
    const existingUser = await usersRepo.findByEmail(invitation.email)

    pageData = {
      status: 'valid',
      quinielaId: invitation.quinielaId,
      maskedEmail: maskEmail(invitation.email),
      userExists: existingUser !== null,
      hasSession,
      sessionEmailMatches,
      shortCode,
    }
  }

  const boundAcceptAsExisting = acceptInviteAsExistingUser.bind(null, locale, shortCode)
  const boundAcceptAsNew = acceptInviteAsNewUser.bind(null, locale, shortCode)

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <InviteAcceptanceFlow
          pageData={pageData}
          lang={locale}
          dict={dict.invite}
          pendingApprovalDict={dict.pendingApproval}
          acceptAsExistingAction={boundAcceptAsExisting}
          acceptAsNewAction={boundAcceptAsNew}
        />
      </div>
    </main>
  )
}
