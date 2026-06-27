import { notFound, redirect } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { TournamentBracketService } from '@/tournaments/TournamentBracketService'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { ExpectedResultsRepository } from '@/expectedResults/ExpectedResultsRepository'
import { ExpectedResultsService } from '@/expectedResults/ExpectedResultsService'
import { GroupProjectionService } from '@/tournaments/GroupProjectionService'
import { BracketCascadeService } from '@/tournaments/BracketCascadeService'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'
import { AppSettingsService } from '@/appSettings/AppSettingsService'
import { AppSettingsRepository } from '@/appSettings/AppSettingsRepository'
import type { Locale } from '@/i18n/i18n.types'
import PendingApprovalScreen from '@/app/[lang]/(private)/_components/PendingApprovalScreen'
import TournamentBracketClient from './_components/TournamentBracketClient'

type PageProps = {
  params: Promise<{ lang: string; quinielaId: string }>
}

export default async function BracketPage({ params }: PageProps) {
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

  const bracketService = new TournamentBracketService(
    new CompetitionsRepository(),
    new ExpectedResultsService(new ExpectedResultsRepository(), membershipsRepository),
    membershipsRepository,
    new GroupProjectionService(),
    new BracketCascadeService(),
    new AppSettingsService(new AppSettingsRepository()),
  )

  const result = await bracketService.getBracketForMember(quinielaId, effectiveUserId)

  // Member list for the quiniela switcher — only the approved quinielas this
  // user belongs to. Resolved regardless of bracket access so the switcher
  // can still let the user navigate away from a denied/empty bracket.
  const quinielasService = new QuinielasService(new QuinielasRepository())
  const quinielasResult = await quinielasService.listQuinielasForUser(effectiveUserId)
  const quinielas = quinielasResult.success ? quinielasResult.quinielas : []

  if (!result.success && result.error === 'NOT_APPROVED_MEMBER') {
    return <PendingApprovalScreen lang={locale} dict={dict.pendingApproval} />
  }

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <TournamentBracketClient
          result={result}
          quinielas={quinielas}
          quinielaId={quinielaId}
          lang={locale}
          dict={dict.bracket}
        />
      </div>
    </main>
  )
}
