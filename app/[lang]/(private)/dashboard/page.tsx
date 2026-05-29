import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { hasLocale } from '@/i18n/getDictionary'

type PageProps = { params: Promise<{ lang: string }> }

export default async function DashboardPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  redirect(`/${lang}/welcome`)
}
