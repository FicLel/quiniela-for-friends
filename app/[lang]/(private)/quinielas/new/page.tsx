import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import { createQuiniela } from './actions'
import CreateQuinielaForm from './_components/CreateQuinielaForm'

type PageProps = {
  params: Promise<{ lang: string }>
}

export default async function NewQuinielaPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  const boundCreateQuiniela = createQuiniela.bind(null, locale)

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <CreateQuinielaForm dict={dict.quinielas} createAction={boundCreateQuiniela} />
        </div>
      </div>
    </main>
  )
}
