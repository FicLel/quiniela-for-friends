import type { Metadata } from 'next'
import ChangePasswordForm from './_components/ChangePasswordForm'

export const metadata: Metadata = {
  title: 'Set New Password — Quiniela for Friends',
}

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4 py-12">
      <ChangePasswordForm />
    </main>
  )
}
