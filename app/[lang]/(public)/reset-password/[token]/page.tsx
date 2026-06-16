import { redirect, notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { PasswordResetService } from '@/auth/PasswordResetService'
import { PasswordResetRepository } from '@/auth/PasswordResetRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { Locale } from '@/i18n/i18n.types'
import ResetPasswordForm from './_components/ResetPasswordForm'
import { resetPassword } from './actions'

type PageProps = {
  params: Promise<{ lang: string; token: string }>
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { lang, token: rawToken } = await params
  if (!hasLocale(lang)) notFound()

  const locale = lang as Locale

  // If the user already has a valid session, they don't need to reset.
  const authClient = new AuthClient()
  const sessionToken = await authClient.getTokenFromServerAction()
  const session = sessionToken ? await authClient.verifyToken(sessionToken) : null
  if (session) {
    redirect(`/${locale}/welcome`)
  }

  // Validate the reset token before showing the form.
  const service = new PasswordResetService(
    new PasswordResetRepository(),
    new UsersRepository(),
    authClient,
  )
  const isValid = await service.validateToken(rawToken)
  if (!isValid) {
    redirect(`/${locale}/welcome`)
  }

  const dict = await getDictionary(locale)
  const boundResetPassword = resetPassword.bind(null, locale, rawToken)

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
      <ResetPasswordForm
        dict={dict.resetPassword}
        resetPasswordAction={boundResetPassword}
      />
    </main>
  )
}
