'use client'

import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/i18n.types'

export type BracketQuinielaSwitcherProps = {
  quinielas: { id: string; name: string }[]
  selectedId: string
  lang: Locale
  dict: { label: string }
}

/**
 * Dropdown to switch between quinielas' bracket views.
 * Only rendered by the caller when quinielas.length > 1 (per approved design
 * decision — see TournamentBracketClient).
 *
 * Switching navigates client-side to the new quinielaId's bracket route via
 * router.push (no full page reload), since quinielaId is a path segment
 * (not a query param) for this route.
 */
export default function BracketQuinielaSwitcher({
  quinielas,
  selectedId,
  lang,
  dict,
}: BracketQuinielaSwitcherProps) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    router.push(`/${lang}/quinielas/${id}/bracket`)
  }

  const selectedName = quinielas.find((q) => q.id === selectedId)?.name ?? quinielas[0]?.name ?? ''

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="bracket-quiniela-switcher"
        className="text-xs font-medium uppercase tracking-wide text-green-700"
      >
        {dict.label}
      </label>

      <div className="relative w-full sm:w-64">
        <select
          id="bracket-quiniela-switcher"
          value={selectedId}
          onChange={handleChange}
          className="block w-full cursor-pointer appearance-none rounded-md border border-green-300 bg-white py-1.5 pl-4 pr-8 text-sm font-semibold text-green-900 shadow-sm transition hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          aria-label={`${dict.label}: ${selectedName}`}
        >
          {quinielas.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>

        <span
          className="pointer-events-none absolute inset-y-0 right-2 flex items-center"
          aria-hidden="true"
        >
          <svg
            className="h-4 w-4 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </div>
  )
}
