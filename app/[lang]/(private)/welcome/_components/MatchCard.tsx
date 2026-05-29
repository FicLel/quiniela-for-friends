'use client'

import { useState } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'

export type MatchCardData = {
  id: string
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string
  homeTeamCrest: string | null
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
  scheduledAt: string   // ISO 8601 UTC — formatted client-side
  status: string
}

type MatchCardProps = MatchCardData & {
  dict: Dictionary['welcome']
  lang: Locale
}

type TeamCrestProps = {
  crest: string | null
  tla: string
  name: string
}

function TeamCrest({ crest, tla, name }: TeamCrestProps) {
  const [imgFailed, setImgFailed] = useState(false)

  if (!crest || imgFailed) {
    return (
      <div
        aria-label={tla}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600"
      >
        {tla}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- crest origins are external; next/image requires allow-listed domains
    <img
      src={crest}
      alt={name}
      width={40}
      height={40}
      className="h-10 w-10 rounded-full object-contain"
      onError={() => setImgFailed(true)}
    />
  )
}

function FormattedDate({ scheduledAt, lang }: { scheduledAt: string; lang: Locale }) {
  // suppressHydrationWarning: server renders UTC string; client renders local timezone.
  const formatted = new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(scheduledAt))

  return <span suppressHydrationWarning>{formatted}</span>
}

function StatusBadge({
  status,
  dict,
}: {
  status: string
  dict: Dictionary['welcome']
}) {
  const label =
    status in dict.status
      ? dict.status[status as keyof typeof dict.status]
      : status.replace(/_/g, ' ')

  const colorClass =
    status === 'FINISHED'
      ? 'bg-gray-100 text-gray-600'
      : status === 'IN_PLAY' || status === 'PAUSED'
        ? 'bg-green-100 text-green-800'
        : 'bg-blue-50 text-blue-700'

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${colorClass}`}
    >
      {label}
    </span>
  )
}

export default function MatchCard({
  homeTeamName,
  homeTeamTla,
  homeTeamCrest,
  awayTeamName,
  awayTeamTla,
  awayTeamCrest,
  scheduledAt,
  status,
  dict,
  lang,
}: MatchCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <TeamCrest crest={homeTeamCrest} tla={homeTeamTla} name={homeTeamName} />
          <span className="text-sm font-semibold text-gray-800">{homeTeamName}</span>
        </div>

        <span className="text-sm font-bold text-gray-400">{dict.vs}</span>

        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="text-sm font-semibold text-gray-800">{awayTeamName}</span>
          <TeamCrest crest={awayTeamCrest} tla={awayTeamTla} name={awayTeamName} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          <FormattedDate scheduledAt={scheduledAt} lang={lang} />
        </p>
        <StatusBadge status={status} dict={dict} />
      </div>
    </div>
  )
}
