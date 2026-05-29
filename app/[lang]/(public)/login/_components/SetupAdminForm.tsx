'use client'

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import type { CreateFirstAdminResult } from '@/auth/auth.types'
import type { Dictionary } from '@/i18n/getDictionary'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Props = {
  dict: Dictionary['setup']
  createFirstAdminAction: (
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<CreateFirstAdminResult>
}

export default function SetupAdminForm({ dict, createFirstAdminAction }: Props) {
  const pathname = usePathname()
  const locale = pathname.split('/')[1]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [setupComplete, setSetupComplete] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  function clearErrors() {
    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')
    setFormError('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearErrors()

    let hasError = false

    if (!email || !EMAIL_RE.test(email)) {
      setEmailError(dict.errors.invalidEmail)
      hasError = true
    }

    if (password.length < 8) {
      setPasswordError(dict.errors.passwordTooShort)
      hasError = true
    }

    if (!hasError && password !== confirmPassword) {
      setConfirmPasswordError(dict.errors.passwordsMismatch)
      return
    }

    if (hasError) return

    startTransition(async () => {
      const result = await createFirstAdminAction(email, password, confirmPassword)
      if (!result.success) {
        if (result.error === 'SETUP_ALREADY_COMPLETE') {
          setFormError(dict.errors.alreadyComplete)
          setSetupComplete(true)
        } else {
          setFormError(dict.errors.unknown)
        }
      }
    })
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-green-900">{dict.heading}</h1>
          <p className="mt-1 text-sm text-gray-500">{dict.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="setup-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.emailLabel}
            </label>
            <input
              id="setup-email"
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
            {emailError && (
              <p role="alert" className="mt-1.5 text-sm text-red-700">
                {emailError}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="setup-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="setup-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={dict.passwordPlaceholder}
              />
              <button
                type="button"
                aria-label={showPassword ? dict.hidePassword : dict.showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {passwordError && (
              <p role="alert" className="mt-1.5 text-sm text-red-700">
                {passwordError}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="setup-confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.confirmPasswordLabel}
            </label>
            <div className="relative">
              <input
                id="setup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={dict.passwordPlaceholder}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? dict.hideConfirmPassword : dict.showConfirmPassword}
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {confirmPasswordError && (
              <p role="alert" className="mt-1.5 text-sm text-red-700">
                {confirmPasswordError}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}{' '}
              {setupComplete && (
                <a href={`/${locale}/login`} className="underline">
                  {dict.logIn}
                </a>
              )}
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
                {dict.creatingAccount}
              </span>
            ) : (
              dict.createAccount
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  )
}
