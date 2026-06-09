'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { LeaderboardRow } from '@/scoring/scoring.types'
import type { Dictionary } from '@/i18n/getDictionary'
import PlayerPredictionsModal from './PlayerPredictionsModal'

type Props = {
  rows: LeaderboardRow[]
  callerUserId: string
  lang: string
  quinielaId: string
  dict: Dictionary['leaderboard']
}

const PODIUM: Record<number, { bg: string; border: string; pts: string; callerRing: string; emoji: string }> = {
  1: { bg: 'bg-yellow-50', border: 'border-yellow-200', pts: 'text-yellow-700', callerRing: 'ring-2 ring-green-400', emoji: '🥇' },
  2: { bg: 'bg-gray-50',   border: 'border-gray-200',  pts: 'text-gray-600',   callerRing: 'ring-2 ring-green-400', emoji: '🥈' },
  3: { bg: 'bg-amber-50',  border: 'border-amber-100', pts: 'text-amber-700',  callerRing: 'ring-2 ring-green-400', emoji: '🥉' },
}

export default function LeaderboardClient({ rows, callerUserId, lang, quinielaId, dict }: Props) {
  const [showPoints, setShowPoints] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null)

  const hasScores = rows.some((r) => r.totalPoints > 0 || r.exactScoreHits > 0)
  const callerRow = rows.find((r) => r.userId === callerUserId)
  const showSticky = callerRow !== undefined && callerRow.rank > 3

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="mb-4 text-6xl" role="img" aria-label="Trophy">
          🏆
        </span>
        <p className="text-base text-gray-500">{dict.noMembers}</p>
      </div>
    )
  }

  return (
    <div className={showSticky ? 'pb-20' : ''}>
      {/* Page header */}
      <div className="mb-6">
        <Link
          href={`/${lang}/quinielas/${quinielaId}/members`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-green-700 transition hover:text-green-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02z"
              clipRule="evenodd"
            />
          </svg>
          {dict.backToMembers}
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="Trophy">
            🏆
          </span>
          <h1 className="text-2xl font-bold text-green-900">{dict.title}</h1>
          <button
            type="button"
            onClick={() => setShowPoints((v) => !v)}
            aria-expanded={showPoints}
            aria-label={dict.pointsSystemTitle}
            className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 transition hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            ?
          </button>
        </div>
      </div>

      {/* Points-system panel */}
      {showPoints && (
        <div className="mb-6 rounded-xl border border-green-100 bg-white px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{dict.pointsSystemTitle}</h2>
            <button
              type="button"
              onClick={() => setShowPoints(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {dict.pointsSystemClose}
            </button>
          </div>
          <ul className="space-y-3">
            {[
              { label: dict.rule1Label, desc: dict.rule1Desc },
              { label: dict.rule2Label, desc: dict.rule2Desc },
              { label: dict.rule3Label, desc: dict.rule3Desc },
            ].map(({ label, desc }) => (
              <li key={label}>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-medium text-green-700">{dict.maxPoints}</p>
        </div>
      )}

      {/* No-scores info banner */}
      {!hasScores && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-blue-700">{dict.noScoresBanner}</p>
        </div>
      )}

      {/* Mobile: card list for all players (hidden on sm+) */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => {
          const isCaller = row.userId === callerUserId
          const style = PODIUM[row.rank]
          return (
            <div
              key={row.userId}
              className={`flex w-full flex-row items-center gap-4 rounded-xl border px-4 py-3 ${style ? `${style.bg} ${style.border}` : 'border-gray-100 bg-white'} ${isCaller ? 'ring-2 ring-green-400' : ''}`}
            >
              {/* Rank indicator */}
              <div className="flex w-8 shrink-0 items-center justify-center">
                {style ? (
                  <span className="text-2xl" role="img" aria-label={`Rank ${row.rank} medal`}>
                    {style.emoji}
                  </span>
                ) : (
                  <span className="text-base font-black tabular-nums text-gray-500">#{row.rank}</span>
                )}
              </div>
              {/* Email + YOU badge + points */}
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm text-gray-900" title={row.email}>
                    {row.email}
                  </span>
                  {isCaller && (
                    <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      {dict.youBadge}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-baseline gap-1">
                  <span className={`text-xl font-black tabular-nums ${style ? style.pts : 'text-gray-800'}`}>
                    {row.totalPoints}
                  </span>
                  <span className="text-xs text-gray-400">{dict.pts}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: full table for all players (hidden on mobile) */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">{dict.colPlayer}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colExactTitle}>⚽ {dict.colExact}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colOutcomeTitle}>✓ {dict.colOutcome}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colHomeGoalPtsTitle}>{dict.colHomeGoalPts}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colAwayGoalPtsTitle}>{dict.colAwayGoalPts}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colOutcomePtsTitle}>{dict.colOutcomePts}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colExtraPtsTitle}>{dict.colExtraPts}</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={dict.colPtsTitle}>⭐ {dict.colPts}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const isCaller = row.userId === callerUserId
                return (
                  <tr
                    key={row.userId}
                    className={`transition ${isCaller ? 'bg-green-50' : 'hover:bg-green-50'}`}
                    aria-current={isCaller ? 'true' : undefined}
                  >
                    <td className="px-4 py-3 font-mono text-sm tabular-nums text-gray-400">{row.rank}</td>
                    <td className="px-2 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm text-gray-900">{row.email}</span>
                        {isCaller && (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                            {dict.youBadge}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.exactScoreHits}</td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.correctOutcomeHits}</td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.homeGoalPoints}</td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.awayGoalPoints}</td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.outcomePoints}</td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-gray-600">{row.extraQuestionPoints}</td>
                    <td className="px-2 py-3 text-right text-sm font-bold tabular-nums text-gray-800">{row.totalPoints}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setSelectedUserId(row.userId); setSelectedUserEmail(row.email) }}
                        className="text-xs text-green-700 underline hover:text-green-900 transition whitespace-nowrap"
                      >
                        {dict.seePredictionsButton}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Predictions modal */}
      {selectedUserId && (
        <PlayerPredictionsModal
          quinielaId={quinielaId}
          userId={selectedUserId}
          userEmail={selectedUserEmail ?? ''}
          onClose={() => { setSelectedUserId(null); setSelectedUserEmail(null) }}
          dict={dict}
        />
      )}

      {/* Sticky footer: visible when caller is ranked 4+ */}
      {showSticky && callerRow && (
        <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between border-t border-green-100 bg-white px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-green-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25z"
                clipRule="evenodd"
              />
            </svg>
            {dict.youAre}{' '}
            <span className="font-semibold text-green-800">#{callerRow.rank}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold tabular-nums text-green-800">
              {callerRow.totalPoints}
            </span>
            <span className="text-xs text-gray-400">{dict.pts}</span>
          </div>
        </div>
      )}
    </div>
  )
}
