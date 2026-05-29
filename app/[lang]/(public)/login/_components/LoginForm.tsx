'use client'

import { useState, useTransition } from 'react'
import type { LoginErrorCode, LoginResult } from '@/auth/auth.types'
import type { Dictionary } from '@/i18n/getDictionary'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Props = {
  dict: Dictionary['login']
  loginAction: (email: string, password: string) => Promise<LoginResult>
}

export default function LoginForm({ dict, loginAction }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<LoginErrorCode | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    if (!EMAIL_RE.test(email)) {
      setError('VALIDATION_ERROR')
      return
    }

    startTransition(async () => {
      const result = await loginAction(email, password)
      if (!result?.success) {
        setError(result?.error ?? 'UNKNOWN_ERROR')
      }
    })
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-green-900">{dict.signIn}</h1>
          <p className="mt-1 text-sm text-gray-500">{dict.enterEmailPassword}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder={dict.emailPlaceholder}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder={dict.passwordPlaceholder}
            />
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {dict.errors[error]}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                {dict.signingIn}
              </span>
            ) : (
              dict.signIn
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
