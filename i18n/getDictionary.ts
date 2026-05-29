import 'server-only'

import type { Locale } from './i18n.types'
import { LOCALES } from './i18n.types'

const dictionaries = {
  es: () => import('./dictionaries/es.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}

export const hasLocale = (locale: string): locale is Locale =>
  LOCALES.includes(locale as Locale)

export const getDictionary = async (locale: Locale) => dictionaries[locale]()

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>
