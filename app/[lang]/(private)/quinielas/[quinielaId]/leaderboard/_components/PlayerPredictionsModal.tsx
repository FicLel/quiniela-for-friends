'use client'

import { useState, useEffect, useRef } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { PlayerPredictionEntry } from '@/scoring/scoring.types'

type Props = {
  quinielaId: string
  userId: string
  userEmail: string
  onClose: () => void
  dict: Dictionary['leaderboard']
}

export default function PlayerPredictionsModal({
  quinielaId,
  userId,
  userEmail,
  onClose,
  dict,
}: Props) {
  const [predictions, setPredictions] = useState<PlayerPredictionEntry[] | null>(null)
  const [error, setError] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setPredictions(null)
      setError(false)
      try {
        const res = await fetch(`/api/quinielas/${quinielaId}/members/${userId}/predictions`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) setPredictions(data.predictions)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [quinielaId, userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  const title = dict.predictionsModalTitle.replace('{email}', userEmail)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-4 top-16 z-50 mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl sm:inset-x-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-4 shrink-0 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {predictions === null && !error && (
            <p className="text-sm text-gray-400">{dict.viewerLoading ?? 'Loading…'}</p>
          )}
          {error && (
            <p className="text-sm text-red-500">{dict.predictionsLoadError}</p>
          )}
          {predictions !== null && predictions.length === 0 && (
            <p className="text-sm text-gray-500">{dict.predictionsEmptyState}</p>
          )}
          {predictions !== null && predictions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-3 text-left">{dict.predictionsColMatch}</th>
                    <th className="pb-2 pr-3 text-right">{dict.predictionsColPredicted}</th>
                    <th className="pb-2 pr-3 text-right">{dict.predictionsColResult}</th>
                    <th className="pb-2 text-right">{dict.predictionsColPts}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {predictions.map((p) => {
                    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                      new Date(p.scheduledAt),
                    )
                    return (
                      <tr key={p.matchId} className="text-gray-700">
                        <td className="py-2 pr-3">
                          <p className="font-medium">
                            {p.homeTeamName} vs {p.awayTeamName}
                          </p>
                          <p className="text-xs text-gray-400">{date}</p>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {p.predictedHomeScore}–{p.predictedAwayScore}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {p.regulationHomeGoals}–{p.regulationAwayGoals}
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {p.totalPoints}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
