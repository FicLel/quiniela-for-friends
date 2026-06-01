'use client'

import type { LeaderboardRow } from '@/scoring/scoring.types'

type Props = {
  rows: LeaderboardRow[]
  callerUserId: string
}

const MEDAL_CLASSES: Record<number, string> = {
  1: 'ring-2 ring-yellow-400 bg-yellow-50',
  2: 'ring-2 ring-gray-400 bg-gray-50',
  3: 'ring-2 ring-amber-600 bg-amber-50',
}

const RANK_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
}

export default function LeaderboardClient({ rows, callerUserId }: Props) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="text-base text-green-700">No predictions have been scored yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg">
      <h1 className="mb-6 text-2xl font-bold text-green-900">Leaderboard</h1>

      <ol className="space-y-2">
        {rows.map((row) => {
          const isTop3 = row.rank <= 3
          const isCaller = row.userId === callerUserId
          const medalClass = isTop3 ? MEDAL_CLASSES[row.rank] : ''
          const callerClass = isCaller && !isTop3 ? 'bg-green-50' : ''

          return (
            <li
              key={row.userId}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${medalClass} ${callerClass}`}
              aria-current={isCaller ? 'true' : undefined}
            >
              {/* Rank + email */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 w-8 text-center text-sm font-bold tabular-nums ${
                    row.rank === 1
                      ? 'text-yellow-600'
                      : row.rank === 2
                        ? 'text-gray-500'
                        : row.rank === 3
                          ? 'text-amber-700'
                          : 'text-gray-400'
                  }`}
                >
                  {RANK_LABELS[row.rank] ?? `${row.rank}th`}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {row.email}
                    {isCaller && (
                      <span className="ml-1.5 text-xs font-normal text-green-600">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {row.exactScoreHits} exact · {row.correctOutcomeHits} outcome · {row.predictedMatchCount} predicted
                  </p>
                </div>
              </div>

              {/* Points */}
              <span className="ml-4 shrink-0 text-lg font-bold tabular-nums text-gray-800">
                {row.totalPoints}
                <span className="ml-1 text-xs font-normal text-gray-400">pts</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
