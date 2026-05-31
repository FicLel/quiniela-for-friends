import type { Metadata } from 'next'
import LoginForm from './_components/LoginForm'
import SetupAdminForm from './_components/SetupAdminForm'
import { UsersRepository } from '@/users/UsersRepository'

export const metadata: Metadata = {
  title: 'Login — Quiniela for Friends',
}

export default async function LoginPage() {
  let setupMode = false
  try {
    setupMode = !(await new UsersRepository().hasAnyUser())
  } catch (err) {
    console.error('[LoginPage] Could not check user count:', err)
  }

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
      {setupMode ? <SetupAdminForm /> : <LoginForm />}
    </main>
  )
}
