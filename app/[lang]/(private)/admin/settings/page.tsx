import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { AppSettingsService } from '@/appSettings/AppSettingsService'
import { AppSettingsRepository } from '@/appSettings/AppSettingsRepository'
import type { PredictionMode } from '@/appSettings/appSettings.types'
import type { Locale } from '@/i18n/i18n.types'
import AppSettingsForm from './_components/AppSettingsForm'

type PageProps = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.adminSettings.heading} — ${dict.meta.title}` }
}

export default async function AdminSettingsPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  // Auth gate: must be admin
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  if (session.role !== 'admin') {
    redirect(`/${locale}/welcome`)
  }

  // Fetch current settings (fall back to 'shared' if not yet seeded)
  const service = new AppSettingsService(new AppSettingsRepository())
  const settingsResult = await service.getSettings()
  const currentMode: PredictionMode = settingsResult.success
    ? settingsResult.settings.predictionMode
    : 'shared'

  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-green-900">{dict.adminSettings.heading}</h1>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <AppSettingsForm initialMode={currentMode} dict={dict.adminSettings} />
        </div>
      </div>
    </main>
  )
}
