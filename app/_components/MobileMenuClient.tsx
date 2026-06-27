'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
  const close = () => setOpen(false)

  return (
    <div className="md:hidden">
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

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          role="dialog"
          aria-modal="true"
          aria-label={dict.menuHeading}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl sm:w-md">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h2 className="text-lg font-bold text-green-900">{dict.menuHeading}</h2>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col">
              {isAdmin && (
                <Link
                  href={`/${lang}/quinielas`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.quinielas}
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`/${lang}/dashboard`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.users}
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`/${lang}/admin/settings`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.settings}
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`/${lang}/admin/impersonate`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.impersonateLink}
                </Link>
              )}
              {quinielas.length === 1 && (
                <Link
                  href={`/${lang}/quinielas/${quinielas[0].id}/leaderboard`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.leaderboard}
                </Link>
              )}
              {quinielas.length > 1 &&
                quinielas.map((quiniela) => (
                  <Link
                    key={`leaderboard-${quiniela.id}`}
                    href={`/${lang}/quinielas/${quiniela.id}/leaderboard`}
                    onClick={close}
                    className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                  >
                    {quiniela.name} — {dict.leaderboard}
                  </Link>
                ))}
              {quinielas.length === 1 && (
                <Link
                  href={`/${lang}/quinielas/${quinielas[0].id}/bracket`}
                  onClick={close}
                  className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                >
                  {dict.bracket}
                </Link>
              )}
              {quinielas.length > 1 &&
                quinielas.map((quiniela) => (
                  <Link
                    key={`bracket-${quiniela.id}`}
                    href={`/${lang}/quinielas/${quiniela.id}/bracket`}
                    onClick={close}
                    className="block px-6 py-4 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800"
                  >
                    {quiniela.name} — {dict.bracket}
                  </Link>
                ))}
              <div className="border-t border-gray-100 px-6 py-4">
                <LanguageSwitcher currentLocale={lang} label={dict.switchLanguage} />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
