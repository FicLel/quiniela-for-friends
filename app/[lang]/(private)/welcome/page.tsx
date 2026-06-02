import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { CompetitionsClient } from '@/competitions/CompetitionsClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { CompetitionsService } from '@/competitions/CompetitionsService'
import { ExpectedResultsService } from '@/expectedResults/ExpectedResultsService'
import { ExpectedResultsRepository } from '@/expectedResults/ExpectedResultsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { ScoringService, calculateScore } from '@/scoring/ScoringService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'
import { AuthClient } from '@/auth/AuthClient'
import { AppSettingsService } from '@/appSettings/AppSettingsService'
import { AppSettingsRepository } from '@/appSettings/AppSettingsRepository'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'
import ImportMatchesButton from './_components/ImportMatchesButton'
import WelcomeMatchList from './_components/WelcomeMatchList'
import EmptyState from './_components/EmptyState'
import QuinielaSwitcher from './_components/QuinielaSwitcher'
import type { MatchCardData } from './_components/MatchCard'
import type { Locale } from '@/i18n/i18n.types'
import { saveExpectedResult } from './actions'

type PageProps = {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.welcome.heading} — ${dict.meta.title}` }
}

export default async function WelcomePage({ params, searchParams }: PageProps) {
  const [{ lang }, resolvedSearchParams] = await Promise.all([params, searchParams])
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  const userRole = session?.role ?? 'player'

  // Derive view mode from URL param — default to 'date'
  const viewParam = resolvedSearchParams.view
  const viewMode: 'date' | 'group' =
    viewParam === 'group' ? 'group' : 'date'

  const userId = session?.sub ?? null

  const competitionsRepository = new CompetitionsRepository()
  const competitionsService = new CompetitionsService(
    new CompetitionsClient(),
    competitionsRepository,
  )
  // Pass CompetitionsRepository as the kickoff reader (3rd arg) so the lock
  // gate in ExpectedResultsService prevents predictions after kickoff.
  const expectedResultsService = new ExpectedResultsService(
    new ExpectedResultsRepository(),
    new MembershipsRepository(),
    competitionsRepository,
  )
  const scoringService = new ScoringService(
    new PredictionScoreRepository(),
    competitionsRepository,
  )
  const appSettingsService = new AppSettingsService(new AppSettingsRepository())

  // -------------------------------------------------------------------------
  // Resolve prediction mode and active quiniela
  // -------------------------------------------------------------------------
  const settingsResult = await appSettingsService.getSettings()
  // If settings row is missing, fall back to 'shared' (safe default)
  const predictionMode =
    settingsResult.success ? settingsResult.settings.predictionMode : 'shared'

  // User's quinielas — needed only in per_quiniela mode but fetched in parallel
  const userQuinielas: { id: string; name: string }[] = []
  let activeQuinielaId: string | undefined = undefined

  if (predictionMode === 'per_quiniela' && userId) {
    const quinielasService = new QuinielasService(new QuinielasRepository())
    const quinielasResult = await quinielasService.listQuinielasForUser(userId)
    if (quinielasResult.success && quinielasResult.quinielas.length > 0) {
      for (const q of quinielasResult.quinielas) {
        userQuinielas.push({ id: q.id, name: q.name })
      }
    }

    // Resolve active quiniela from ?quiniela=<uuid> param, falling back to first
    const quinielaParam = resolvedSearchParams.quiniela
    const quinielaParamStr = Array.isArray(quinielaParam) ? quinielaParam[0] : quinielaParam
    const paramMatchesKnown =
      quinielaParamStr !== undefined &&
      userQuinielas.some((q) => q.id === quinielaParamStr)
    activeQuinielaId = paramMatchesKnown
      ? quinielaParamStr
      : userQuinielas[0]?.id
  }

  const [allMatches, isApproved, expectedResults] = await Promise.all([
    competitionsService.getAllMatches(),
    userId ? expectedResultsService.isUserApproved(userId) : Promise.resolve(false),
    // In per_quiniela mode, fetch only predictions for the active quiniela
    userId
      ? predictionMode === 'per_quiniela' && activeQuinielaId !== undefined
        ? expectedResultsService.findByUserIdAndQuiniela(userId, activeQuinielaId)
        : expectedResultsService.getExpectedResultsForUser(userId)
      : Promise.resolve([]),
  ])

  // Build O(1) lookup map: matchId → { homeScore, awayScore }
  const expectedResultsMap = new Map(
    expectedResults.map((r) => [r.matchId, { homeScore: r.homeScore, awayScore: r.awayScore }]),
  )

  // Fetch crowd percentages for all matches in parallel
  const crowdPercentagesMap = new Map<string, { homeWinPct: number; drawPct: number; awayWinPct: number } | null>()
  await Promise.all(
    allMatches.map(async (match) => {
      try {
        const pct = await scoringService.getCrowdPercentages(match.id)
        // Treat all-zero (no predictions) as null
        const hasPredictions = pct.homeWinPct > 0 || pct.drawPct > 0 || pct.awayWinPct > 0
        crowdPercentagesMap.set(match.id, hasPredictions ? pct : null)
      } catch {
        crowdPercentagesMap.set(match.id, null)
      }
    }),
  )

  const now = new Date()
  const knockoutStages = new Set(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'])

  const groupStageMatches: MatchCardData[] = []
  const knockoutMatches: MatchCardData[] = []
  const groupMap = new Map<string, MatchCardData[]>()

  for (const match of allMatches) {
    const savedScore = expectedResultsMap.get(match.id)
    const crowd = crowdPercentagesMap.get(match.id) ?? null
    const isLocked = match.scheduledAt <= now

    const cardData: MatchCardData = {
      id: match.id,
      homeTeamName: match.homeTeamName,
      homeTeamShortName: match.homeTeamShortName,
      homeTeamTla: match.homeTeamTla,
      homeTeamCrest: match.homeTeamCrest,
      awayTeamName: match.awayTeamName,
      awayTeamShortName: match.awayTeamShortName,
      awayTeamTla: match.awayTeamTla,
      awayTeamCrest: match.awayTeamCrest,
      scheduledAt: match.scheduledAt.toISOString(),
      status: match.status,
      stage: match.stage,
      initialHomeScore: savedScore?.homeScore,
      initialAwayScore: savedScore?.awayScore,
      matchupDescription: match.matchupDescription ?? null,
      regulationHomeGoals: match.regulationHomeGoals ?? null,
      regulationAwayGoals: match.regulationAwayGoals ?? null,
      lastSyncedAt: match.lastSyncedAt ? match.lastSyncedAt.toISOString() : null,
      earnedPoints: (() => {
        if (match.regulationHomeGoals == null || match.regulationAwayGoals == null) return null
        const prediction = expectedResultsMap.get(match.id)
        if (!prediction) return null
        return calculateScore(
          { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
          { regulationHomeGoals: match.regulationHomeGoals, regulationAwayGoals: match.regulationAwayGoals },
        ).totalPoints
      })(),
      isLocked,
      crowdHomeWinPct: crowd?.homeWinPct ?? null,
      crowdDrawPct: crowd?.drawPct ?? null,
      crowdAwayWinPct: crowd?.awayWinPct ?? null,
    }

    if (knockoutStages.has(match.stage)) {
      knockoutMatches.push(cardData)
    } else if (match.stage === 'GROUP_STAGE') {
      groupStageMatches.push(cardData)
      // Build group map using the domain object's group field
      const group = match.group
      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }
      groupMap.get(group)!.push(cardData)
    }
  }

  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Resolve the name of the currently selected quiniela (for display in the heading)
  const activeQuinielaName =
    activeQuinielaId !== undefined
      ? userQuinielas.find((q) => q.id === activeQuinielaId)?.name
      : undefined

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-green-900">{dict.welcome.heading}</h1>
          <p className="mt-3 text-base text-green-700">{dict.welcome.subtitle}</p>

          {/* Per-quiniela mode: show switcher and active quiniela name */}
          {predictionMode === 'per_quiniela' && (
            <div className="mt-4">
              {userQuinielas.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {activeQuinielaName && (
                    <p className="text-sm font-medium text-green-800">
                      {activeQuinielaName}
                    </p>
                  )}
                  <QuinielaSwitcher
                    quinielas={userQuinielas}
                    defaultId={activeQuinielaId ?? userQuinielas[0].id}
                    dict={{
                      label: dict.welcome.quinielaSwitcherLabel,
                      noQuinielas: dict.welcome.quinielaSwitcherNoQuinielas,
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-green-700">
                  {dict.welcome.quinielaSwitcherNoQuinielas}
                </p>
              )}
            </div>
          )}
        </div>

        {userRole === 'admin' && (
          <div className="mb-6">
            <ImportMatchesButton userRole={userRole} dict={dict.welcome} />
          </div>
        )}

        {groupStageMatches.length === 0 && knockoutMatches.length === 0 ? (
          <EmptyState dict={dict.welcome} />
        ) : (
          <WelcomeMatchList
            viewMode={viewMode}
            groupStageMatches={groupStageMatches}
            knockoutMatches={knockoutMatches}
            sortedGroups={sortedGroups}
            dict={dict.welcome}
            lang={locale}
            isApproved={isApproved}
            activeQuinielaId={activeQuinielaId}
            onSaveScore={saveExpectedResult}
          />
        )}
      </div>
    </main>
  )
}
