import type { MatchupCard } from '@/tournaments/tournaments.types'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'

type BracketMatchupCardProps = {
  matchup: MatchupCard
  dict: Dictionary['bracket']
  lang: Locale
}

function FormattedDate({ scheduledAt, lang }: { scheduledAt: string; lang: Locale }) {
  const formatted = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(scheduledAt))

  return <time suppressHydrationWarning className="text-xs text-gray-400">{formatted}</time>
}

/**
 * A single knockout bracket matchup card.
 *
 * Stacked layout per the approved design decision:
 *   - Row: home team name : away team name (truncated, never overflows on narrow viewports)
 *   - Line 1 (own prediction), styled lighter/italic.
 *   - Line 2 (actual result), styled bolder, only when the match has synced.
 *   - "No prediction" empty state when unplayed and the member submitted nothing.
 */
export default function BracketMatchupCard({ matchup, dict, lang }: BracketMatchupCardProps) {
  const isPlayed = matchup.result !== null
  const hasPrediction = matchup.prediction !== null

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
      {/* Row 1: scheduled date + played/unplayed status */}
      <div className="mb-2 flex items-center justify-between">
        <FormattedDate scheduledAt={matchup.scheduledAt} lang={lang} />
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
            isPlayed ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'
          }`}
        >
          {isPlayed ? dict.statusPlayed : dict.statusUnplayed}
        </span>
      </div>

      {/* Matchup description / team names */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900"
          title={matchup.homeTeamName}
        >
          {matchup.homeTeamName}
        </span>
        <span className="shrink-0 text-xs font-bold text-gray-300">{dict.vsSeparator}</span>
        <span
          className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-gray-900"
          title={matchup.awayTeamName}
        >
          {matchup.awayTeamName}
        </span>
      </div>

      {!matchup.teamsResolved && (
        <p className="mb-2 text-center text-xs italic text-gray-400">{matchup.matchupDescription}</p>
      )}

      {/* Stacked prediction-then-result */}
      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-gray-50 px-3 py-2.5">
        {/* Line 1: own prediction */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {dict.predictionLabel}
          </span>
          {hasPrediction ? (
            <span className="text-sm font-medium tabular-nums text-gray-600">
              {matchup.prediction!.homeScore}–{matchup.prediction!.awayScore}
            </span>
          ) : (
            <span className="text-xs italic text-gray-400">{dict.noPrediction}</span>
          )}
        </div>

        {/* Line 2: actual result — only shown once played */}
        {isPlayed && (
          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {dict.resultLabel}
            </span>
            <span className="text-base font-bold tabular-nums text-green-800">
              {matchup.result!.homeGoals}–{matchup.result!.awayGoals}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
