'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'

type Team = {
  name: string
  externalId: number
}

type TeamAutocompleteProps = {
  quinielaId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function TeamAutocomplete({
  quinielaId,
  value,
  onChange,
  placeholder = 'Search for a team…',
  disabled = false,
}: TeamAutocompleteProps) {
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  // useId produces a stable, render-safe ID (React 18+)
  const baseId = useId()
  const listboxId = `team-listbox-${baseId}`

  // Fetch all teams once on mount
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadState('loading')
      try {
        const res = await fetch(`/api/quinielas/${quinielaId}/extra-questions/teams`)
        if (!res.ok) throw new Error('Failed to fetch teams')
        const data = (await res.json()) as { success: boolean; teams: Team[] }
        if (cancelled) return
        if (data.success) {
          setAllTeams(data.teams)
          setLoadState('ready')
        } else {
          setLoadState('error')
        }
      } catch {
        if (!cancelled) setLoadState('error')
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [quinielaId])

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const filtered =
    value.length > 0
      ? allTeams.filter((t) => t.name.toLowerCase().includes(value.toLowerCase()))
      : []

  const showDropdown = isOpen && value.length > 0 && loadState === 'ready'

  const handleSelect = useCallback(
    (team: Team) => {
      onChange(team.name)
      setIsOpen(false)
      setActiveIndex(-1)
    },
    [onChange],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) {
        handleSelect(filtered[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled || loadState === 'loading'}
        placeholder={loadState === 'loading' ? 'Loading…' : placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
      />

      {loadState === 'error' && (
        <p className="mt-1 text-xs text-red-600">Failed to load teams.</p>
      )}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Teams"
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400" role="option" aria-selected={false}>
              No teams found
            </li>
          ) : (
            filtered.map((team, idx) => (
              <li
                key={team.externalId}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(team)
                }}
                className={`cursor-pointer px-3 py-2 text-sm transition ${
                  idx === activeIndex
                    ? 'bg-green-50 text-green-900'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {team.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
