import { notFound, redirect } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { Navbar } from '@/app/_components/Navbar'
import type { Locale } from '@/i18n/i18n.types'

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

  return (
    <>
      <Navbar lang={lang as Locale} dict={dict.navbar} isAdmin={isAdmin} />
      {children}
    </>
  )
}
