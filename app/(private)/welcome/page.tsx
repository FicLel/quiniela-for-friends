import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Welcome — Quiniela for Friends',
}

export default function WelcomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-green-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-green-900">
          Welcome to Quiniela for Friends
        </h1>
        <p className="mt-3 text-base text-green-700">
          You&apos;re signed in. Let the games begin.
        </p>
      </div>
    </main>
  )
}
