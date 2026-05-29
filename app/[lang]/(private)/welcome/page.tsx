import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { AuthClient } from '@/auth/AuthClient'
import ImportMatchesButton from './_components/ImportMatchesButton'
import GroupAccordion from './_components/GroupAccordion'
import EmptyState from './_components/EmptyState'
import type { MatchCardData } from './_components/MatchCard'
import type { Locale } from '@/i18n/i18n.types'

type PageProps = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.welcome.heading} — ${dict.meta.title}` }
}

export default async function WelcomePage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  const userRole = session?.role ?? 'player'

  const repository = new CompetitionsRepository()
  const matches = await repository.findAllGroupStageMatches()

  const groupMap = new Map<string, MatchCardData[]>()
  for (const match of matches) {
    const group = match.group
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
    }
    groupMap.get(group)!.push({
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
    })
  }

  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-green-900">{dict.welcome.heading}</h1>
          <p className="mt-3 text-base text-green-700">{dict.welcome.subtitle}</p>
        </div>

        <div className="mb-6">
          <ImportMatchesButton userRole={userRole} dict={dict.welcome} />
        </div>

        {sortedGroups.length === 0 ? (
          <EmptyState dict={dict.welcome} />
        ) : (
          <div className="flex flex-col gap-4">
            {sortedGroups.map(([group, groupMatches]) => (
              <GroupAccordion
                key={group}
                group={group}
                matches={groupMatches}
                dict={dict.welcome}
                lang={locale}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
