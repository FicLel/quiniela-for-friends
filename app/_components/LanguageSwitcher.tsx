'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LOCALES } from '@/i18n/i18n.types'
import type { Locale } from '@/i18n/i18n.types'

type LanguageSwitcherProps = {
  currentLocale: Locale
  label: string
}

export function LanguageSwitcher({ currentLocale, label }: LanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()

  function switchTo(newLocale: Locale) {
    const segments = pathname.split('/')
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          onClick={() => switchTo(locale)}
          disabled={locale === currentLocale}
          className={`rounded px-2 py-1 text-xs font-semibold uppercase transition-colors ${
            locale === currentLocale
              ? 'bg-white text-green-900 cursor-default'
              : 'text-green-200 hover:text-white'
          }`}
        >
          {locale}
        </button>
      ))}
    </nav>
  )
}
