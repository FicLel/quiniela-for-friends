import Link from 'next/link'
import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'
import { LanguageSwitcher } from './LanguageSwitcher'

type NavbarProps = {
  lang: Locale
  dict: Dictionary['navbar']
  isAdmin?: boolean
}

export function Navbar({ lang, dict, isAdmin = false }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-green-800 bg-green-900 px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-bold tracking-wide text-white">{dict.appName}</span>
        <nav className="flex items-center gap-4">
          <Link
            href={`/${lang}/quinielas`}
            className="text-sm font-medium text-green-200 transition hover:text-white"
          >
            {dict.quinielas}
          </Link>
          {isAdmin && (
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium text-green-200 transition hover:text-white"
            >
              {dict.users}
            </Link>
          )}
        </nav>
      </div>
      <LanguageSwitcher currentLocale={lang} label={dict.switchLanguage} />
    </header>
  )
}
