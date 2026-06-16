'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { SyncRegulationResultsResult } from '@/competitions/competitions.types'

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
  stage: string
  initialHomeScore?: number
  initialAwayScore?: number
  matchupDescription?: string | null
  regulationHomeGoals?: number | null   // official result, null until synced
  regulationAwayGoals?: number | null
  lastSyncedAt?: string | null          // ISO 8601
  earnedPoints?: number | null          // 0–3, null if not yet scored
  crowdHomeWinPct?: number | null       // 0–100, null = no predictions yet
  crowdDrawPct?: number | null
  crowdAwayWinPct?: number | null
  isLocked?: boolean                    // computed from kickoff_at server-side
}

type MatchCardProps = MatchCardData & {
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  showDate?: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
  userRole?: 'admin' | 'player'
  onSyncResult?: (matchId: string, home: number, away: number) => Promise<SyncRegulationResultsResult>
}

// ---------------------------------------------------------------------------
// EarnedPointsBadge — color-coded points badge shown on final matches
// ---------------------------------------------------------------------------

function EarnedPointsBadge({ points }: { points: number }) {
  const colorClass =
    points === 3
      ? 'bg-green-100 text-green-800'
      : points === 0
        ? 'bg-gray-100 text-gray-500'
        : 'bg-amber-100 text-amber-800'

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${colorClass}`}>
      +{points} pts
    </span>
  )
}

// ---------------------------------------------------------------------------
// TeamCrest
// ---------------------------------------------------------------------------

type TeamCrestProps = { crest: string | null; tla: string; name: string }

function TeamCrest({ crest, tla, name }: TeamCrestProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const cls =
    'h-14 w-14 rounded-full ring-2 ring-gray-200 sm:h-14 sm:w-14 lg:h-14 lg:w-14'

  if (!crest || imgFailed) {
    return (
      <div
        aria-label={tla}
        className={`${cls} flex items-center justify-center bg-gray-100 text-xs font-bold text-gray-600`}
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
      width={56}
      height={56}
      className={`${cls} object-contain`}
      onError={() => setImgFailed(true)}
    />
  )
}

// ---------------------------------------------------------------------------
// FormattedTime — HH:MM only
// ---------------------------------------------------------------------------

function FormattedTime({ scheduledAt, lang }: { scheduledAt: string; lang: Locale }) {
  const formatted = new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(scheduledAt))

  return <time suppressHydrationWarning>{formatted}</time>
}

// ---------------------------------------------------------------------------
// FormattedDate — "Jun 28" style, used for knockout matches
// ---------------------------------------------------------------------------

function FormattedDate({ scheduledAt, lang }: { scheduledAt: string; lang: Locale }) {
  const formatted = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(scheduledAt))

  return <time suppressHydrationWarning className="text-xs text-gray-400">{formatted}</time>
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status, dict }: { status: string; dict: Dictionary['welcome'] }) {
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

// ---------------------------------------------------------------------------
// ScoreCounter — vertical box widget, min 0
// ---------------------------------------------------------------------------

type ScoreCounterProps = {
  incrementLabel: string
  decrementLabel: string
  initialValue?: number | null
  disabled?: boolean
  onSave?: (value: number) => void
}

function ScoreCounter({
  incrementLabel,
  decrementLabel,
  initialValue,
  disabled = false,
  onSave,
}: ScoreCounterProps) {
  const [count, setCount] = useState<number | null>(initialValue ?? null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function fireOnSave(value: number) {
    if (disabled) return
    onSave?.(value)
  }

  function scheduleDebounce(value: number) {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fireOnSave(value)
    }, 500)
  }

  function handleIncrement() {
    if (disabled) return
    const next = count === null ? 1 : count + 1
    setCount(next)
    scheduleDebounce(next)
  }

  function handleDecrement() {
    if (disabled || count === null || count === 0) return
    const next = count - 1
    setCount(next)
    scheduleDebounce(next)
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Ignore if focus is moving to another element inside this same counter widget
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (count !== null) fireOnSave(count)
  }

  const disabledButtonClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''

  return (
    <div
      className="flex w-10 flex-col overflow-hidden rounded-lg border border-gray-200 sm:w-12 lg:w-14"
      onBlur={handleBlur}
    >
      {/* Up button */}
      <button
        type="button"
        aria-label={incrementLabel}
        onClick={handleIncrement}
        disabled={disabled}
        className={`flex h-7 w-full items-center justify-center bg-gray-50 text-gray-500 transition hover:bg-green-50 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 sm:h-8 ${disabledButtonClasses}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Score display */}
      <div className="flex h-8 w-full items-center justify-center border-y border-gray-200 bg-white sm:h-9 lg:h-10">
        <span className="text-base font-bold tabular-nums text-gray-800 sm:text-lg lg:text-xl">
          {count === null ? '-' : count}
        </span>
      </div>

      {/* Down button */}
      <button
        type="button"
        aria-label={decrementLabel}
        onClick={handleDecrement}
        disabled={disabled || count === null || count === 0}
        className={`flex h-7 w-full items-center justify-center bg-gray-50 text-gray-500 transition hover:bg-green-50 hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 ${disabledButtonClasses}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WinBadge — circle letter (W/V) + percentage
// ---------------------------------------------------------------------------

function WinBadge({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border border-green-600 text-[10px] font-bold leading-none text-green-700"
        aria-hidden="true"
      >
        {label}
      </span>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminResultEditor — official result entry, visible to admins only
// ---------------------------------------------------------------------------

type AdminResultEditorProps = {
  matchId: string
  homeTeamName: string
  awayTeamName: string
  regulationHomeGoals?: number | null
  regulationAwayGoals?: number | null
  isFinal: boolean
  dict: Dictionary['welcome']
  onSyncResult: (matchId: string, home: number, away: number) => Promise<SyncRegulationResultsResult>
}

function AdminResultEditor({
  matchId,
  homeTeamName,
  awayTeamName,
  regulationHomeGoals,
  regulationAwayGoals,
  isFinal,
  dict,
  onSyncResult,
}: AdminResultEditorProps) {
  const router = useRouter()
  const [homeValue, setHomeValue] = useState(regulationHomeGoals != null ? String(regulationHomeGoals) : '')
  const [awayValue, setAwayValue] = useState(regulationAwayGoals != null ? String(regulationAwayGoals) : '')
  const [result, setResult] = useState<SyncRegulationResultsResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const homeNum = Number(homeValue)
  const awayNum = Number(awayValue)
  const isValid =
    homeValue.trim() !== '' &&
    awayValue.trim() !== '' &&
    Number.isInteger(homeNum) &&
    Number.isInteger(awayNum) &&
    homeNum >= 0 &&
    awayNum >= 0

  function handleSave() {
    if (!isValid) return
    setResult(null)
    startTransition(async () => {
      const res = await onSyncResult(matchId, homeNum, awayNum)
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {dict.officialResultLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={homeValue}
          onChange={(e) => setHomeValue(e.target.value)}
          disabled={isPending}
          aria-label={`${homeTeamName} official goals`}
          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-center text-sm tabular-nums text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-100"
        />
        <span className="text-xs font-bold text-gray-400">:</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={awayValue}
          onChange={(e) => setAwayValue(e.target.value)}
          disabled={isPending}
          aria-label={`${awayTeamName} official goals`}
          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-center text-sm tabular-nums text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isValid}
          className="ml-auto rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          {isPending ? dict.savingResult : isFinal ? dict.updateResultButton : dict.saveResultButton}
        </button>
      </div>

      {result !== null && result.success && (
        <p role="status" className="mt-2 text-xs text-green-700">
          {dict.resultSaved}
        </p>
      )}

      {result !== null && !result.success && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {dict.syncResultErrors[result.error] ?? dict.syncResultErrors.UNKNOWN_ERROR}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MatchCard
// ---------------------------------------------------------------------------

export default function MatchCard({
  id,
  homeTeamName,
  homeTeamTla,
  homeTeamCrest,
  awayTeamName,
  awayTeamTla,
  awayTeamCrest,
  scheduledAt,
  status,
  initialHomeScore,
  initialAwayScore,
  matchupDescription,
  regulationHomeGoals,
  regulationAwayGoals,
  earnedPoints,
  crowdHomeWinPct,
  crowdDrawPct,
  crowdAwayWinPct,
  isLocked = false,
  dict,
  lang,
  isApproved,
  showDate = false,
  onSaveScore,
  userRole,
  onSyncResult,
}: MatchCardProps) {
  // Keep latest score values in refs so the onSave callbacks always capture
  // the current value of the other side when both are needed together.
  const homeScoreRef = useRef(initialHomeScore ?? 0)
  const awayScoreRef = useRef(initialAwayScore ?? 0)

  function handleSaveHome(value: number) {
    homeScoreRef.current = value
    onSaveScore?.(id, value, awayScoreRef.current)
  }

  function handleSaveAway(value: number) {
    awayScoreRef.current = value
    onSaveScore?.(id, homeScoreRef.current, value)
  }

  // A match is "final" when the official regulation result has been synced
  const isFinal = regulationHomeGoals != null && regulationAwayGoals != null

  // Counters are disabled when not approved, or when the match is locked/final
  const countersDisabled = !isApproved || isLocked || isFinal

  // Crowd percentages: null when all three are null (no predictions yet)
  const hasCrowdData = crowdHomeWinPct != null || crowdDrawPct != null || crowdAwayWinPct != null

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4 lg:px-6 lg:py-4">

      {/* Row 1: match time + optional date (left) + status badge (right) */}
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <div className="flex flex-col items-start">
          <p className="text-xs font-medium text-gray-500">
            <FormattedTime scheduledAt={scheduledAt} lang={lang} />
          </p>
          {showDate && <FormattedDate scheduledAt={scheduledAt} lang={lang} />}
        </div>
        <div className="flex items-center gap-2">
          {isFinal && earnedPoints != null && (
            <EarnedPointsBadge points={earnedPoints} />
          )}
          <StatusBadge status={status} dict={dict} />
        </div>
      </div>

      {/* Matchup description — shown for TBD knockout bracket slots */}
      {homeTeamTla === 'TBD' && matchupDescription && (
        <p className="mb-2 text-center text-xs italic text-gray-400">{matchupDescription}</p>
      )}

      {/* Row 2: home team | score area | away team */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">

        {/* Home team column */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <TeamCrest crest={homeTeamCrest} tla={homeTeamTla} name={homeTeamName} />
          <span className="max-w-[72px] truncate text-center text-xs font-semibold leading-tight text-gray-800 sm:max-w-none sm:text-sm">
            {homeTeamName}
          </span>
        </div>

        {/* Score area: static display when final, counters otherwise */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          {isFinal ? (
            // Final state: static official score
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl">
                  {regulationHomeGoals}
                </span>
                <span className="text-lg font-bold text-gray-400">:</span>
                <span className="text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl">
                  {regulationAwayGoals}
                </span>
              </div>
              {/* User's predicted score shown below the official result */}
              {(initialHomeScore != null || initialAwayScore != null) && (
                <p className="text-xs text-gray-400" aria-label="Your prediction">
                  {'Your pick:'} {initialHomeScore ?? 0}–{initialAwayScore ?? 0}
                </p>
              )}
            </div>
          ) : (
            // Interactive counters (locked or open)
            <div className="flex items-center gap-1 sm:gap-2">
              <ScoreCounter
                incrementLabel={`Increase ${homeTeamName} score`}
                decrementLabel={`Decrease ${homeTeamName} score`}
                initialValue={initialHomeScore}
                disabled={countersDisabled}
                onSave={handleSaveHome}
              />
              <span className="text-sm font-bold text-gray-400">:</span>
              <ScoreCounter
                incrementLabel={`Increase ${awayTeamName} score`}
                decrementLabel={`Decrease ${awayTeamName} score`}
                initialValue={initialAwayScore}
                disabled={countersDisabled}
                onSave={handleSaveAway}
              />
            </div>
          )}

          {/* Locked label — shown when locked but not yet final */}
          {isLocked && !isFinal && (
            <p className="mt-1 text-xs font-medium text-gray-400" role="status">
              Predictions closed
            </p>
          )}
        </div>

        {/* Away team column */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <TeamCrest crest={awayTeamCrest} tla={awayTeamTla} name={awayTeamName} />
          <span className="max-w-[72px] truncate text-center text-xs font-semibold leading-tight text-gray-800 sm:max-w-none sm:text-sm">
            {awayTeamName}
          </span>
        </div>

      </div>

      {/* Row 3: crowd percentages — suppressed when both teams are TBD */}
      {!(homeTeamTla === 'TBD' && awayTeamTla === 'TBD') && (
        <div className="mt-3 flex items-center justify-between px-2 sm:mt-4 sm:px-4 lg:px-6">
          {hasCrowdData ? (
            <>
              <WinBadge label={dict.winLabel} pct={crowdHomeWinPct ?? 0} />
              <span className="text-xs text-gray-400">{crowdDrawPct ?? 0}%</span>
              <WinBadge label={dict.winLabel} pct={crowdAwayWinPct ?? 0} />
            </>
          ) : (
            <p className="w-full text-center text-xs text-gray-400">No predictions yet</p>
          )}
        </div>
      )}

      {/* Admin-only: enter/correct the official result and recalculate points */}
      {userRole === 'admin' && onSyncResult && (
        <AdminResultEditor
          matchId={id}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          regulationHomeGoals={regulationHomeGoals}
          regulationAwayGoals={regulationAwayGoals}
          isFinal={isFinal}
          dict={dict}
          onSyncResult={onSyncResult}
        />
      )}

    </div>
  )
}
