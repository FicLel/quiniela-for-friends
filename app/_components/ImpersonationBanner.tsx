import { endImpersonation } from '@/app/[lang]/(private)/admin/impersonate/actions'
import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'

type ImpersonationBannerProps = {
  lang: Locale
  email: string
  dict: Dictionary['impersonation']
}

export function ImpersonationBanner({ lang, email, dict }: ImpersonationBannerProps) {
  async function handleExit() {
    'use server'
    await endImpersonation(lang)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span>{dict.viewingAs.replace('{email}', email)}</span>
      <form action={handleExit}>
        <button
          type="submit"
          className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-900"
        >
          {dict.exit}
        </button>
      </form>
    </div>
  )
}
