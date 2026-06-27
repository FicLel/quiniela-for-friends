'use client'

import { Fragment, useState } from 'react'
import type { BracketStage, GetBracketResult } from '@/tournaments/tournaments.types'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import BracketQuinielaSwitcher from './BracketQuinielaSwitcher'
import BracketMatchupCard from './BracketMatchupCard'

type TournamentBracketClientProps = {
  result: GetBracketResult
  quinielas: { id: string; name: string }[]
  quinielaId: string
  lang: Locale
  dict: Dictionary['bracket']
}

const MAIN_STAGES: BracketStage[] = [
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
]

const STAGE_LABEL_KEYS: Record<BracketStage, keyof Dictionary['bracket']> = {
  ROUND_OF_32: 'stageRoundOf32',
  ROUND_OF_16: 'stageRoundOf16',
  QUARTER_FINALS: 'stageQuarterFinals',
  SEMI_FINALS: 'stageSemiFinals',
  THIRD_PLACE: 'stageThirdPlace',
  FINAL: 'stageFinal',
}

export default function TournamentBracketClient({
  result,
  quinielas,
  quinielaId,
  lang,
  dict,
}: TournamentBracketClientProps) {
  const stageGroups = result.success ? result.bracket.stages : []
  const mainStageGroups = stageGroups.filter((g) => MAIN_STAGES.includes(g.stage))
  const thirdPlaceGroup = stageGroups.find((g) => g.stage === 'THIRD_PLACE')

  const availableStages = mainStageGroups.map((g) => g.stage)
  const defaultIndex = availableStages.length > 0 ? availableStages.length - 1 : 0

  const [activeStageIndex, setActiveStageIndex] = useState(defaultIndex)
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')

  function goToStage(index: number) {
    if (index === activeStageIndex) return
    setSlideDirection(index > activeStageIndex ? 'forward' : 'backward')
    setActiveStageIndex(index)
  }

  // -------------------------------------------------------------------------
  // Error / empty states
  // -------------------------------------------------------------------------

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="mb-4 text-6xl" role="img" aria-label="Error">
          ⚠️
        </span>
        <p className="text-base text-gray-500">{dict.errorState}</p>
      </div>
    )
  }

  if (stageGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="mb-4 text-6xl" role="img" aria-label="Bracket">
          🏆
        </span>
        <p className="text-base text-gray-500">{dict.notYetAvailable}</p>
      </div>
    )
  }

  const activeStage = availableStages[activeStageIndex]
  const activeGroup = mainStageGroups.find((g) => g.stage === activeStage)
  const slideClass =
    slideDirection === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <div>
      {/* Header + quiniela switcher */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold text-green-900">{dict.title}</h1>
        {quinielas.length > 1 && (
          <BracketQuinielaSwitcher
            quinielas={quinielas}
            selectedId={quinielaId}
            lang={lang}
            dict={{ label: dict.quinielaSwitcherLabel }}
          />
        )}
      </div>

      {/* Desktop: bracket-path navigator with › separators between stages */}
      <nav
        aria-label={dict.roundNavLabel}
        className="mb-4 hidden items-center gap-1 overflow-x-auto pb-2 sm:flex"
        role="tablist"
      >
        {mainStageGroups.map((group, idx) => {
          const isActive = idx === activeStageIndex
          return (
            <Fragment key={group.stage}>
              {idx > 0 && (
                <span aria-hidden="true" className="shrink-0 px-0.5 text-sm text-green-400">
                  ›
                </span>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goToStage(idx)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${
                  isActive
                    ? 'bg-green-700 text-white'
                    : 'bg-white text-green-700 ring-1 ring-green-200 hover:bg-green-50'
                }`}
              >
                {dict[STAGE_LABEL_KEYS[group.stage]]}
              </button>
            </Fragment>
          )
        })}
      </nav>

      {/* Mobile: prev/next navigator with current stage name and position counter */}
      <div className="mb-4 flex items-center justify-between sm:hidden">
        <button
          type="button"
          aria-label="Previous stage"
          disabled={activeStageIndex === 0}
          onClick={() => goToStage(activeStageIndex - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-green-700 transition hover:bg-green-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          ‹
        </button>

        <div className="text-center">
          <span className="text-sm font-semibold text-green-900">
            {dict[STAGE_LABEL_KEYS[activeStage]]}
          </span>
          <span className="block text-xs text-green-600">
            {activeStageIndex + 1} / {availableStages.length}
          </span>
        </div>

        <button
          type="button"
          aria-label="Next stage"
          disabled={activeStageIndex === availableStages.length - 1}
          onClick={() => goToStage(activeStageIndex + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-green-700 transition hover:bg-green-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
        >
          ›
        </button>
      </div>

      {/* Animated content area — overflow-hidden clips the slide */}
      <div className="overflow-hidden">
        <div key={activeStageIndex} className={`flex flex-col gap-3 ${slideClass}`} role="tabpanel">
          {activeGroup?.matchups.map((matchup) => (
            <BracketMatchupCard key={matchup.matchId} matchup={matchup} dict={dict} lang={lang} />
          ))}
        </div>

        {/* Third-place branch — rendered alongside the Final, never as a tab */}
        {thirdPlaceGroup && thirdPlaceGroup.matchups.length > 0 && activeStage === 'FINAL' && (
          <div className="mt-6 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-4 py-3 sm:px-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <span aria-hidden="true">🥉</span>
              {dict.stageThirdPlace}
            </h2>
            <div className="flex flex-col gap-3">
              {thirdPlaceGroup.matchups.map((matchup) => (
                <BracketMatchupCard key={matchup.matchId} matchup={matchup} dict={dict} lang={lang} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
