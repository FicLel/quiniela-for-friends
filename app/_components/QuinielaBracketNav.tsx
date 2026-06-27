'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'

type QuinielaBracketNavProps = {
  lang: string
  quinielas: { id: string; name: string }[]
  dict: { bracket: string }
}

/**
 * Desktop nav link/dropdown to the Tournament Bracket screen for the
 * caller's quiniela(s). Mirrors QuinielaLeaderboardNav exactly: a direct
 * link when there's exactly one quiniela, a dropdown when there are several,
 * and nothing when there are none.
 */
export function QuinielaBracketNav({
  lang,
  quinielas,
  dict,
}: QuinielaBracketNavProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  if (quinielas.length === 0) {
    return null
  }

  if (quinielas.length === 1) {
    return (
      <Link
        href={`/${lang}/quinielas/${quinielas[0].id}/bracket`}
        className="text-sm font-medium text-green-200 transition hover:text-white"
      >
        {dict.bracket}
      </Link>
    )
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-sm font-medium text-green-200 transition hover:text-white"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {dict.bracket} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg bg-white shadow-lg">
          {quinielas.map((quiniela) => (
            <Link
              key={quiniela.id}
              href={`/${lang}/quinielas/${quiniela.id}/bracket`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
            >
              {quiniela.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
