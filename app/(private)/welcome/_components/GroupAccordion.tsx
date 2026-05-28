'use client'

import { useState } from 'react'
import MatchCard, { type MatchCardData } from './MatchCard'

export type GroupAccordionProps = {
  group: string          // e.g. "GROUP_A"
  matches: MatchCardData[]
  defaultOpen?: boolean  // defaults to false (collapsed)
}

/**
 * Transform "GROUP_A" → "Group A"
 */
function formatGroupLabel(group: string): string {
  // "GROUP_A" → ["GROUP", "A"] → "Group A"
  const parts = group.split('_')
  if (parts.length < 2) return group
  const [, ...rest] = parts
  return `Group ${rest.join(' ')}`
}

export default function GroupAccordion({
  group,
  matches,
  defaultOpen = false,
}: GroupAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const panelId = `group-panel-${group}`
  const buttonId = `group-btn-${group}`

  return (
    <div className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
      {/* Accordion header */}
      <button
        id={buttonId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        <span className="text-base font-semibold text-green-900">
          {formatGroupLabel(group)}
        </span>

        {/* Chevron icon — rotates when open */}
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

      {/* Accordion panel */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className="flex flex-col gap-2 px-5 pb-4"
      >
        {matches.map((match) => (
          <MatchCard key={match.id} {...match} />
        ))}
      </div>
    </div>
  )
}
