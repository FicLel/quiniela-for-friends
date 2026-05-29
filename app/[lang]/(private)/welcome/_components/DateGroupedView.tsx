'use client'

import MatchCard, { type MatchCardData } from './MatchCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'

type DateGroupedViewProps = {
  matches: MatchCardData[]
  dict: Dictionary['welcome']
  lang: Locale
}

function toLocalDateKey(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DateGroupedView({ matches, dict, lang }: DateGroupedViewProps) {
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
                  <MatchCard key={match.id} {...match} dict={dict} lang={lang} />
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
