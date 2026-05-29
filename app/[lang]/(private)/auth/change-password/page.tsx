import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import ChangePasswordForm from './_components/ChangePasswordForm'
import { changePassword } from './actions'
import type { Locale } from '@/i18n/i18n.types'

type PageProps = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `${dict.changePassword.heading} — ${dict.meta.title}` }
}

export default async function ChangePasswordPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale
  const boundChangePassword = changePassword.bind(null, locale)

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4 py-12">
      <ChangePasswordForm dict={dict.changePassword} changePasswordAction={boundChangePassword} />
    </main>
  )
}
