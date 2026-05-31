import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import type { Locale } from '@/i18n/i18n.types'
import InviteAcceptanceFlow, { type PageData } from './_components/InviteAcceptanceFlow'
import { acceptInviteAsExistingUser, acceptInviteAsNewUser } from './actions'

type PageProps = {
  params: Promise<{ lang: string; shortCode: string }>
}

export default async function InvitePage({ params }: PageProps) {
  const { lang, shortCode } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const invitationsRepo = new InvitationsRepository()
  const invitation = await invitationsRepo.findByShortCode(shortCode)

  let pageData: PageData

  if (!invitation) {
    pageData = { status: 'invalid', reason: 'NOT_FOUND' }
  } else if (invitation.revokedAt !== null) {
    pageData = { status: 'invalid', reason: 'REVOKED' }
  } else if (invitation.expiresAt < new Date()) {
    pageData = { status: 'invalid', reason: 'EXPIRED' }
  } else {
    const authClient = new AuthClient()
    const sessionToken = await authClient.getTokenFromServerAction()
    const session = sessionToken ? await authClient.verifyToken(sessionToken) : null

    pageData = {
      status: 'valid',
      quinielaId: invitation.quinielaId,
      hasSession: session !== null,
      shortCode,
    }
  }

  const boundAcceptAsExisting = acceptInviteAsExistingUser.bind(null, locale, shortCode)
  const boundAcceptAsNew = acceptInviteAsNewUser.bind(null, locale, shortCode)

  return (
    <main
      style={{
        backgroundImage: "url('/imagen-fondo-quiniela.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      className="flex min-h-screen w-full items-center justify-center px-4 py-12"
    >
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
