import Link from 'next/link'
import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'
import { LanguageSwitcher } from './LanguageSwitcher'
import { QuinielaLeaderboardNav } from './QuinielaLeaderboardNav'
import { MobileMenuClient } from './MobileMenuClient'

type NavbarProps = {
  lang: Locale
  dict: Dictionary['navbar']
  isAdmin?: boolean
  quinielas?: { id: string; name: string }[]
}

export function Navbar({ lang, dict, isAdmin = false, quinielas = [] }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-green-800 bg-green-900 px-6 py-3">
      <div className="flex items-center gap-6">
        <Link
          href={`/${lang}/welcome`}
          className="text-sm font-bold tracking-wide text-white transition hover:text-green-200"
        >
          {dict.appName}
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {isAdmin && (
            <Link
              href={`/${lang}/quinielas`}
              className="text-sm font-medium text-green-200 transition hover:text-white"
            >
              {dict.quinielas}
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium text-green-200 transition hover:text-white"
            >
              {dict.users}
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${lang}/admin/settings`}
              className="text-sm font-medium text-green-200 transition hover:text-white"
            >
              {dict.settings}
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${lang}/admin/impersonate`}
              className="text-sm font-medium text-green-200 transition hover:text-white"
            >
              {dict.impersonateLink}
            </Link>
          )}
          <QuinielaLeaderboardNav
            lang={lang}
            quinielas={quinielas}
            dict={{ leaderboard: dict.leaderboard, selectQuiniela: dict.selectQuiniela }}
          />
        </nav>
      </div>
      <div className="hidden md:block">
        <LanguageSwitcher currentLocale={lang} label={dict.switchLanguage} />
      </div>
      <MobileMenuClient
        lang={lang}
        dict={dict}
        isAdmin={isAdmin}
        quinielas={quinielas}
      />
    </header>
  )
}
