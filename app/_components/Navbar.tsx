import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'
import { LanguageSwitcher } from './LanguageSwitcher'

type NavbarProps = {
  lang: Locale
  dict: Dictionary['navbar']
}

export function Navbar({ lang, dict }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-green-800 bg-green-900 px-6 py-3">
      <span className="text-sm font-bold tracking-wide text-white">{dict.appName}</span>
      <LanguageSwitcher currentLocale={lang} label={dict.switchLanguage} />
    </header>
  )
}
