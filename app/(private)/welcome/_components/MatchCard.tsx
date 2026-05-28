'use client'

import { useState } from 'react'

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

function FormattedDate({ scheduledAt }: { scheduledAt: string }) {
  // suppressHydrationWarning: server renders UTC string; client renders local timezone.
  // React will reconcile silently without a hydration error.
  const formatted = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(scheduledAt))

  return <span suppressHydrationWarning>{formatted}</span>
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ')

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
}: MatchCardData) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      {/* Teams row */}
      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex flex-1 items-center gap-2">
          <TeamCrest crest={homeTeamCrest} tla={homeTeamTla} name={homeTeamName} />
          <span className="text-sm font-semibold text-gray-800">{homeTeamName}</span>
        </div>

        <span className="text-sm font-bold text-gray-400">vs</span>

        {/* Away team */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="text-sm font-semibold text-gray-800">{awayTeamName}</span>
          <TeamCrest crest={awayTeamCrest} tla={awayTeamTla} name={awayTeamName} />
        </div>
      </div>

      {/* Date + status row */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          <FormattedDate scheduledAt={scheduledAt} />
        </p>
        <StatusBadge status={status} />
      </div>
    </div>
  )
}
