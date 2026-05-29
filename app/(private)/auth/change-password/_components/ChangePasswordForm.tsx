'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/app/(private)/auth/change-password/actions'
import type { ChangePasswordErrorCode } from '@/auth/auth.types'

// Password policy: min 8 chars, uppercase, lowercase, digit.
function meetsPolicy(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  )
}

function getErrorMessage(code: ChangePasswordErrorCode): string {
  switch (code) {
    case 'POLICY_VIOLATION':
      return 'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a digit.'
    case 'PASSWORDS_DO_NOT_MATCH':
      return 'Passwords do not match.'
    case 'FLAG_UPDATE_FAILED':
      return 'Your password was changed but we could not update your account. Please contact support.'
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please log in again.'
    case 'UNKNOWN_ERROR':
      return 'Something went wrong. Please try again.'
  }
}

export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<ChangePasswordErrorCode | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    // Client-side guard 1: password must satisfy the policy.
    if (!meetsPolicy(newPassword)) {
      setError('POLICY_VIOLATION')
      return
    }

    // Client-side guard 2: passwords must match.
    if (newPassword !== confirmPassword) {
      setError('PASSWORDS_DO_NOT_MATCH')
      return
    }

    startTransition(async () => {
      // changePassword() calls redirect() on success, so if it returns it always failed.
      const result = await changePassword(newPassword, confirmPassword)
      if (!result?.success) {
        setError(result?.error ?? 'UNKNOWN_ERROR')
      }
    })
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-green-900">Set your new password</h1>
          <p className="mt-2 text-sm text-gray-500">
            Choose a password you&apos;ll remember. It must have at least 8 characters, one
            uppercase, one lowercase, and one digit.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* New password */}
          <div className="mb-4">
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="••••••••"
            />
          </div>

          {/* Confirm password */}
          <div className="mb-4">
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="••••••••"
            />
          </div>

          {/* Inline error */}
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {getErrorMessage(error)}
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
                Saving…
              </span>
            ) : (
              'Set new password'
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
