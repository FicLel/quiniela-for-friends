'use client'

import MatchCard, { type MatchCardData } from './MatchCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { SyncRegulationResultsResult } from '@/competitions/competitions.types'

type DateGroupedViewProps = {
  matches: MatchCardData[]
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
  userRole?: 'admin' | 'player'
  onSyncResult?: (matchId: string, home: number, away: number) => Promise<SyncRegulationResultsResult>
  lastFinishedMatchId?: string | null
  setTargetElement?: (el: HTMLElement | null) => void
}

function toLocalDateKey(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DateGroupedView({
  matches,
  dict,
  lang,
  isApproved,
  onSaveScore,
  userRole,
  onSyncResult,
  lastFinishedMatchId = null,
  setTargetElement,
}: DateGroupedViewProps) {
  if (matches.length === 0) return null

  // Group matches by local calendar date, preserving insertion order
  const dateMap = new Map<string, MatchCardData[]>()
  for (const match of matches) {
    const key = toLocalDateKey(match.scheduledAt)
    if (!dateMap.has(key)) {
      dateMap.set(key, [])
    }
    dateMap.get(key)!.push(match)
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(dateMap.entries()).map(([, dayMatches]) => {
        const firstScheduledAt = dayMatches[0].scheduledAt
        const dateLabel = new Intl.DateTimeFormat(lang, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(new Date(firstScheduledAt))

        return (
          <div key={toLocalDateKey(firstScheduledAt)}>
            <h2
              suppressHydrationWarning
              className="mb-3 text-base font-semibold capitalize text-green-900"
            >
              {dateLabel}
            </h2>
            <div className="flex flex-col gap-3">
              {[...dayMatches]
                .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                .map((match) => (
                  <div
                    key={match.id}
                    ref={match.id === lastFinishedMatchId ? setTargetElement : undefined}
                  >
                    <MatchCard
                      {...match}
                      dict={dict}
                      lang={lang}
                      isApproved={isApproved}
                      onSaveScore={onSaveScore}
                      userRole={userRole}
                      onSyncResult={onSyncResult}
                    />
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
