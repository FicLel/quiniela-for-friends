'use client'

import { useQuinielaSwitcher } from '../_hooks/useQuinielaSwitcher'

export type QuinielaSwitcherProps = {
  quinielas: { id: string; name: string }[]
  defaultId: string
  dict: { label: string; noQuinielas: string }
  /** Called whenever the selected quiniela changes (receives the new id). */
  onSelect?: (id: string) => void
}

/**
 * A pill-style dropdown selector that lets the user switch between quinielas.
 * Rendered only in `per_quiniela` prediction mode.
 *
 * The selected quiniela is reflected in / read from the `?quiniela=<uuid>` URL
 * search param via the `useQuinielaSwitcher` hook.
 */
export default function QuinielaSwitcher({
  quinielas,
  defaultId,
  dict,
  onSelect,
}: QuinielaSwitcherProps) {
  const { selectedId, select } = useQuinielaSwitcher(defaultId)

  if (quinielas.length === 0) {
    return (
      <p className="text-sm text-green-700">{dict.noQuinielas}</p>
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    select(id)
    onSelect?.(id)
  }

  const selectedName = quinielas.find((q) => q.id === selectedId)?.name ?? quinielas[0].name

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="quiniela-switcher"
        className="text-xs font-medium uppercase tracking-wide text-green-700"
      >
        {dict.label}
      </label>

      {/* Pill-style select wrapper */}
      <div className="relative w-full">
        <select
          id="quiniela-switcher"
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

        {/* Chevron icon */}
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
