import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { MembershipsService } from '@/memberships/MembershipsService'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { InvitationsService } from '@/invitations/InvitationsService'
import { InvitationsRepository } from '@/invitations/InvitationsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import type { Locale } from '@/i18n/i18n.types'
import type { InvitationWithStatus } from '@/invitations/invitations.types'
import MembersClient from './_components/MembersClient'
import PendingApprovalScreen from '@/app/[lang]/(private)/_components/PendingApprovalScreen'
import ExtraQuestionsFloatingButton from '../_components/ExtraQuestionsFloatingButton'
import { inviteMember, removeMember, revokeInvite, leaveQuiniela, approveMember } from './actions'

type PageProps = {
  params: Promise<{ lang: string; quinielaId: string }>
}

export default async function MembersPage({ params }: PageProps) {
  const { lang, quinielaId } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  const membershipsService = new MembershipsService(new MembershipsRepository())
  const membersResult = await membershipsService.listMembers(quinielaId)

  if (!membersResult.success) {
    notFound()
  }

  const { members } = membersResult

  // Determine if caller is a member and their role
  const callerMembership = members.find((m) => m.userId === session.sub)
  if (!callerMembership) {
    // Caller is not a member — redirect to quinielas list
    redirect(`/${locale}/quinielas`)
  }

  const isAdmin = callerMembership.role === 'admin'

  // AC-13: Gate pending members — show pending approval screen if not yet approved
  if (callerMembership.approvedAt === null && !isAdmin) {
    return <PendingApprovalScreen lang={locale} dict={dict.pendingApproval} />
  }

  // Only fetch invitations for admins (service enforces this)
  let invitations: InvitationWithStatus[] = []
  if (isAdmin) {
    const invitationsService = new InvitationsService(
      new InvitationsRepository(),
      new MembershipsRepository(),
      new UsersRepository(),
    )
    const invResult = await invitationsService.listInvitations(quinielaId, session.sub)
    if (invResult.success) {
      invitations = invResult.invitations
    }
  }

  const boundInviteMember = inviteMember.bind(null, locale, quinielaId)
  const boundRemoveMember = removeMember.bind(null, locale, quinielaId)
  const boundRevokeInvite = revokeInvite.bind(null, locale, quinielaId)
  const boundLeaveQuiniela = leaveQuiniela.bind(null, locale, quinielaId)
  const boundApproveMember = isAdmin
    ? approveMember.bind(null, locale, quinielaId)
    : undefined

  // Extra questions floating button data
  const extraQuestionsRepo = new ExtraQuestionsRepository()
  const [totalQuestions, unansweredCount] = await Promise.all([
    extraQuestionsRepo.countAll(quinielaId),
    extraQuestionsRepo.countUnansweredOpenByUser(quinielaId, session.sub),
  ])

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Navigation links */}
        <div className="mb-4 flex items-center justify-end gap-2">
          {isAdmin && (
            <Link
              href={`/${locale}/quinielas/${quinielaId}/admin/extra-questions`}
              className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 shadow-sm transition hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1"
            >
              Extra Questions
            </Link>
          )}
          <Link
            href={`/${locale}/quinielas/${quinielaId}/leaderboard`}
            className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
          >
            Leaderboard
          </Link>
        </div>

        <MembersClient
          members={members}
          invitations={invitations}
          callerMembership={{
            role: callerMembership.role,
            membershipId: callerMembership.membershipId,
          }}
          quinielaId={quinielaId}
          lang={locale}
          dict={dict.members}
          inviteMemberAction={boundInviteMember}
          removeMemberAction={boundRemoveMember}
          revokeInviteAction={boundRevokeInvite}
          leaveQuinielaAction={boundLeaveQuiniela}
          approveMemberAction={boundApproveMember}
        />
      </div>

      <ExtraQuestionsFloatingButton
        quinielaId={quinielaId}
        lang={locale}
        unansweredCount={unansweredCount}
        totalQuestions={totalQuestions}
      />
    </main>
  )
}
