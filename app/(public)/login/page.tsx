import type { Metadata } from 'next'
import SoccerAnimation from './_components/SoccerAnimation'
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4 py-12 lg:flex-row lg:justify-center lg:gap-16">
      {/* Animation panel */}
      <div className="flex w-full max-w-sm flex-col items-center justify-center lg:max-w-md">
        <SoccerAnimation />
      </div>

      {/* Form panel */}
      <div className="mt-10 flex w-full items-center justify-center lg:mt-0">
        {setupMode ? <SetupAdminForm /> : <LoginForm />}
      </div>
    </main>
  )
}
