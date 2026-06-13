'use client'

import { useState, useTransition } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { StartImpersonationActionResult } from '../actions'

type Props = {
  dict: Dictionary['impersonation']
  startImpersonationAction: (email: string) => Promise<StartImpersonationActionResult>
}

export default function ImpersonationEntryForm({ dict, startImpersonationAction }: Props) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<StartImpersonationActionResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)

    startTransition(async () => {
      const res = await startImpersonationAction(email.trim())
      if (!res.success) {
        setResult(res)
      }
    })
  }

  const errorMessages: Record<string, string> = {
    NOT_ADMIN: dict.errorNotAdmin,
    USER_NOT_FOUND: dict.errorUserNotFound,
    CANNOT_IMPERSONATE_ADMIN: dict.errorCannotImpersonateAdmin,
    UNKNOWN_ERROR: dict.errorUnknown,
  }

  const errorMessage = result !== null && !result.success ? errorMessages[result.error] : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="impersonate-email" className="mb-1.5 block text-sm font-medium text-gray-700">
          {dict.emailLabel}
        </label>
        <input
          id="impersonate-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          placeholder={dict.emailPlaceholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
      >
        {isPending ? dict.starting : dict.submit}
      </button>
    </form>
  )
}
