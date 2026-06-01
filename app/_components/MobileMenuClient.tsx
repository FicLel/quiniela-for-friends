'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'
import { LanguageSwitcher } from './LanguageSwitcher'

type MobileMenuClientProps = {
  lang: Locale
  dict: Dictionary['navbar']
  isAdmin?: boolean
  quinielas?: { id: string; name: string }[]
}

export function MobileMenuClient({
  lang,
  dict,
  isAdmin = false,
  quinielas = [],
}: MobileMenuClientProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const close = () => setOpen(false)

  return (
    <div className="relative md:hidden" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex flex-col items-center justify-center gap-1 p-1"
      >
        <span className="block h-0.5 w-5 bg-white" />
        <span className="block h-0.5 w-5 bg-white" />
        <span className="block h-0.5 w-5 bg-white" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg bg-white shadow-lg">
          {isAdmin && (
            <Link
              href={`/${lang}/quinielas`}
              onClick={close}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
            >
              {dict.quinielas}
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${lang}/dashboard`}
              onClick={close}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
            >
              {dict.users}
            </Link>
          )}
          {quinielas.length === 1 && (
            <Link
              href={`/${lang}/quinielas/${quinielas[0].id}/leaderboard`}
              onClick={close}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
            >
              {dict.leaderboard}
            </Link>
          )}
          {quinielas.length > 1 &&
            quinielas.map((quiniela) => (
              <Link
                key={quiniela.id}
                href={`/${lang}/quinielas/${quiniela.id}/leaderboard`}
                onClick={close}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
              >
                {quiniela.name}
              </Link>
            ))}
          <div className="border-t border-gray-100 px-4 py-2">
            <LanguageSwitcher currentLocale={lang} label={dict.switchLanguage} />
          </div>
        </div>
      )}
    </div>
  )
}
