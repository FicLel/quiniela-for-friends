'use client'

import { useState } from 'react'
import MatchCard, { type MatchCardData } from './MatchCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { SyncRegulationResultsResult } from '@/competitions/competitions.types'

export type GroupAccordionProps = {
  group: string
  matches: MatchCardData[]
  defaultOpen?: boolean
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
  userRole?: 'admin' | 'player'
  onSyncResult?: (matchId: string, home: number, away: number) => Promise<SyncRegulationResultsResult>
  registerRef?: (matchId: string) => (el: HTMLElement | null) => void
}

function formatGroupLabel(group: string, groupWord: string): string {
  const parts = group.split('_')
  if (parts.length < 2) return group
  const [, ...rest] = parts
  return `${groupWord} ${rest.join(' ')}`
}

export default function GroupAccordion({
  group,
  matches,
  defaultOpen = false,
  dict,
  lang,
  isApproved,
  onSaveScore,
  userRole,
  onSyncResult,
  registerRef,
}: GroupAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const panelId = `group-panel-${group}`
  const buttonId = `group-btn-${group}`

  return (
    <div className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
      <button
        id={buttonId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        <span className="text-base font-semibold text-green-900">
          {formatGroupLabel(group, dict.group)}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-5 w-5 text-green-700 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className="flex flex-col gap-2 px-5 pb-4"
      >
        {matches.map((match) => (
          <div
            key={match.id}
            ref={registerRef?.(match.id)}
            data-match-id={match.id}
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
}
