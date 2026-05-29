import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { UsersRepository } from '@/users/UsersRepository'
import SoccerAnimation from './_components/SoccerAnimation'
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4 py-12 lg:flex-row lg:justify-center lg:gap-16">
      <div className="flex w-full max-w-sm flex-col items-center justify-center lg:max-w-md">
        <SoccerAnimation dict={dict.login} />
      </div>

      <div className="mt-10 flex w-full items-center justify-center lg:mt-0">
        {setupMode ? (
          <SetupAdminForm dict={dict.setup} createFirstAdminAction={boundCreateFirstAdmin} />
        ) : (
          <LoginForm dict={dict.login} loginAction={boundLogin} />
        )}
      </div>
    </main>
  )
}
