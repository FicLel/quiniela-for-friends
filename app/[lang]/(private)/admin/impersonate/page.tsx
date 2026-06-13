import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import type { Locale } from '@/i18n/i18n.types'
import { startImpersonation } from './actions'
import ImpersonationEntryForm from './_components/ImpersonationEntryForm'

type PageProps = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.impersonation.entryTitle} — ${dict.meta.title}` }
}

export default async function AdminImpersonatePage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  if (session.role !== 'admin') {
    redirect(`/${locale}/welcome`)
  }

  const boundStartImpersonation = startImpersonation.bind(null, locale)

  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-green-900">{dict.impersonation.entryTitle}</h1>
      </div>

      <div className="mx-auto max-w-md px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {session.impersonating && (
            <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {dict.impersonation.currentlyViewingAs.replace('{email}', session.impersonating.email)}
            </p>
          )}
          <p className="mb-6 text-sm text-gray-500">{dict.impersonation.entrySubtitle}</p>
          <ImpersonationEntryForm
            dict={dict.impersonation}
            startImpersonationAction={boundStartImpersonation}
          />
        </div>
      </div>
    </main>
  )
}
