import { notFound, redirect } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { LeaderboardService } from '@/scoring/LeaderboardService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import type { Locale } from '@/i18n/i18n.types'
import LeaderboardClient from './_components/LeaderboardClient'
import ExtraQuestionsFloatingButton from '../_components/ExtraQuestionsFloatingButton'

type PageProps = {
  params: Promise<{ lang: string; quinielaId: string }>
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { lang, quinielaId } = await params
  if (!hasLocale(lang)) notFound()

  const locale = lang as Locale
  const dict = await getDictionary(locale)

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  const effectiveUserId = authClient.getEffectiveUserId(session)

  const membershipsRepository = new MembershipsRepository()
  const isMember = await membershipsRepository.isApprovedMember(quinielaId, effectiveUserId)

  if (!isMember) {
    redirect(`/${locale}/quinielas`)
  }

  const leaderboardService = new LeaderboardService(
    new PredictionScoreRepository(),
    new UsersRepository(),
    membershipsRepository,
  )

  const rows = await leaderboardService.getLeaderboard(quinielaId)

  // Extra questions floating button data
  const extraQuestionsRepo = new ExtraQuestionsRepository()
  const [totalQuestions, unansweredCount] = await Promise.all([
    extraQuestionsRepo.countAll(quinielaId),
    extraQuestionsRepo.countUnansweredOpenByUser(quinielaId, session.sub),
  ])

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <LeaderboardClient
          rows={rows}
          callerUserId={effectiveUserId}
          lang={locale}
          quinielaId={quinielaId}
          dict={dict.leaderboard}
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
