import type { Metadata } from 'next'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { AuthClient } from '@/auth/AuthClient'
import ImportMatchesButton from './_components/ImportMatchesButton'
import GroupAccordion from './_components/GroupAccordion'
import EmptyState from './_components/EmptyState'
import type { MatchCardData } from './_components/MatchCard'

export const metadata: Metadata = {
  title: 'Welcome — Quiniela for Friends',
}

export default async function WelcomePage() {
  // Read current user's role from session cookie
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  const userRole = session?.role ?? 'player'

  // Fetch all group-stage matches
  const repository = new CompetitionsRepository()
  const matches = await repository.findAllGroupStageMatches()

  // Group matches by group field, preserving alphabetical order
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
      // Convert Date to ISO string — Date objects are not serialisable as props
      scheduledAt: match.scheduledAt.toISOString(),
      status: match.status,
    })
  }

  // Sort groups alphabetically
  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-green-900">
            Welcome to Quiniela for Friends
          </h1>
          <p className="mt-3 text-base text-green-700">
            World Cup 2026 — Group Stage Schedule
          </p>
        </div>

        <div className="mb-6">
          <ImportMatchesButton userRole={userRole} />
        </div>

        {sortedGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {sortedGroups.map(([group, groupMatches]) => (
              <GroupAccordion
                key={group}
                group={group}
                matches={groupMatches}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
