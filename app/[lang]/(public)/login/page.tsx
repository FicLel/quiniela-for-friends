import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { UsersRepository } from '@/users/UsersRepository'
import LoginForm from './_components/LoginForm'
import SetupAdminForm from './_components/SetupAdminForm'
import { login, createFirstAdmin } from './actions'
import type { Locale } from '@/i18n/i18n.types'

type PageProps = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)
  return { title: `Login — ${dict.meta.title}` }
}

export default async function LoginPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  let setupMode = false
  try {
    setupMode = !(await new UsersRepository().hasAnyUser())
  } catch (err) {
    console.error('[LoginPage] Could not check user count:', err)
  }

  const boundLogin = login.bind(null, locale)
  const boundCreateFirstAdmin = createFirstAdmin.bind(null, locale)

  return (
    <main
      style={{
        backgroundImage: "url('/imagen-fondo-quiniela.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      className="flex min-h-screen w-full items-center justify-center px-4 py-12"
    >
      {setupMode ? (
        <SetupAdminForm dict={dict.setup} createFirstAdminAction={boundCreateFirstAdmin} />
      ) : (
        <LoginForm dict={dict.login} loginAction={boundLogin} />
      )}
    </main>
  )
}
