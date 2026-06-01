import { notFound, redirect } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { Navbar } from '@/app/_components/Navbar'
import type { Locale } from '@/i18n/i18n.types'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

export default async function PrivateLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  // Determine if the caller is an admin so the Navbar can show the Users link
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) redirect(`/${lang}/login`)

  const isAdmin = session.role === 'admin'

  const quinielasService = new QuinielasService(new QuinielasRepository())
  const quinielasResult = await quinielasService.listQuinielasForUser(session.sub)
  const quinielas = quinielasResult.success
    ? quinielasResult.quinielas.map((q) => ({ id: q.id, name: q.name }))
    : []

  return (
    <>
      <Navbar lang={lang as Locale} dict={dict.navbar} isAdmin={isAdmin} quinielas={quinielas} />
      {children}
    </>
  )
}
