import Link from 'next/link'
import type { Locale } from '@/i18n/i18n.types'
import type { Dictionary } from '@/i18n/getDictionary'

type Props = {
  lang: Locale
  dict: Dictionary['pendingApproval']
}

/**
 * Full-page screen shown to members whose membership has approvedAt = null.
 * Used by quiniela content pages to gate pending members.
 */
export default function PendingApprovalScreen({ lang, dict }: Props) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-green-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 text-yellow-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V12.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-green-900">{dict.heading}</h1>
        <p className="mb-6 text-sm text-gray-600">{dict.message}</p>
        <Link
          href={`/${lang}/quinielas`}
          className="inline-block rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          {dict.backLink}
        </Link>
      </div>
    </main>
  )
}
