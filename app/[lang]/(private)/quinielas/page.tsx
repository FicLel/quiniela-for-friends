import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'
import type { Locale } from '@/i18n/i18n.types'

type PageProps = {
  params: Promise<{ lang: string }>
}

export default async function QuinielasPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    notFound()
  }

  const service = new QuinielasService(new QuinielasRepository())
  const result = await service.listQuinielasForUser(session.sub)

  const quinielas = result.success ? result.quinielas : []

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-green-900">{dict.quinielas.heading}</h1>
          <Link
            href={`/${locale}/quinielas/new`}
            className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            {dict.quinielas.createNew}
          </Link>
        </div>

        {quinielas.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            <p className="text-base text-green-700">{dict.quinielas.empty}</p>
            <Link
              href={`/${locale}/quinielas/new`}
              className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {dict.quinielas.createNew}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {quinielas.map((quiniela) => (
              <li key={quiniela.id}>
                <Link
                  href={`/${locale}/quinielas/${quiniela.id}/members`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-6 py-4 shadow-sm transition hover:border-green-300 hover:shadow-md"
                >
                  <span className="text-base font-semibold text-gray-900">{quiniela.name}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5 text-green-600"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
