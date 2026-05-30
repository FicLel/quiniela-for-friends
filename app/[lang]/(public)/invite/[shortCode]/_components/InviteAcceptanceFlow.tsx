'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { AcceptInviteResult } from '@/invitations/invitations.types'

/**
 * PageData shapes passed from the server component.
 *
 * For valid invitations:
 *  - sessionEmailMatches: true  → caller is logged in with the correct email → show join button
 *  - hasSession: true, sessionEmailMatches: false → logged in with wrong account → email mismatch
 *  - hasSession: false, userExists: true → not logged in, user has account → show login prompt
 *  - hasSession: false, userExists: false → not logged in, new user → show signup form
 */
export type PageData =
  | { status: 'invalid'; reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_ACCEPTED' }
  | {
      status: 'valid'
      quinielaId: string
      maskedEmail: string
      userExists: boolean
      hasSession: boolean
      sessionEmailMatches: boolean
      shortCode: string
    }

type AcceptInviteResultWithPending = AcceptInviteResult & { pendingApproval?: boolean }

type Props = {
  pageData: PageData
  lang: Locale
  dict: Dictionary['invite']
  pendingApprovalDict: Dictionary['pendingApproval']
  acceptAsExistingAction: () => Promise<AcceptInviteResult>
  acceptAsNewAction: (password: string) => Promise<AcceptInviteResultWithPending>
}

export default function InviteAcceptanceFlow({
  pageData,
  lang,
  dict,
  pendingApprovalDict,
  acceptAsExistingAction,
  acceptAsNewAction,
}: Props) {
  if (pageData.status === 'invalid') {
    return <InvalidState reason={pageData.reason} dict={dict} />
  }

  const { maskedEmail, userExists, hasSession, sessionEmailMatches } = pageData

  if (sessionEmailMatches) {
    return (
      <ReadyToJoinState
        maskedEmail={maskedEmail}
        dict={dict}
        acceptAsExistingAction={acceptAsExistingAction}
      />
    )
  }

  if (hasSession && !sessionEmailMatches) {
    return <EmailMismatchState dict={dict} lang={lang} />
  }

  if (userExists) {
    return <LoginPromptState maskedEmail={maskedEmail} dict={dict} lang={lang} />
  }

  return (
    <SignUpState
      maskedEmail={maskedEmail}
      lang={lang}
      dict={dict}
      pendingApprovalDict={pendingApprovalDict}
      acceptAsNewAction={acceptAsNewAction}
    />
  )
}

// ---------------------------------------------------------------------------
// Invalid state
// ---------------------------------------------------------------------------

function InvalidState({
  reason,
  dict,
}: {
  reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_ACCEPTED'
  dict: Dictionary['invite']
}) {
  const messageMap: Record<string, string> = {
    EXPIRED: dict.expiredMessage,
    REVOKED: dict.revokedMessage,
    ALREADY_ACCEPTED: dict.alreadyAcceptedMessage,
    NOT_FOUND: dict.notFoundMessage,
  }

  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
      <h1 className="mb-3 text-2xl font-bold text-green-900">{dict.invalidHeading}</h1>
      <p className="text-sm text-gray-600">{messageMap[reason]}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ready to join (logged-in user, email matches)
// ---------------------------------------------------------------------------

function ReadyToJoinState({
  maskedEmail,
  dict,
  acceptAsExistingAction,
}: {
  maskedEmail: string
  dict: Dictionary['invite']
  acceptAsExistingAction: () => Promise<AcceptInviteResult>
}) {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleJoin() {
    setError(undefined)
    startTransition(async () => {
      const result = await acceptAsExistingAction()
      if (result && !result.success) {
        const errKey = result.error as keyof typeof dict.errors
        setError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
      <h1 className="mb-2 text-2xl font-bold text-green-900">{dict.joinHeading}</h1>
      <p className="mb-6 text-sm text-gray-500">{maskedEmail}</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleJoin}
        className="flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner />
            {dict.joining}
          </span>
        ) : (
          dict.joinButton
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email mismatch state
// ---------------------------------------------------------------------------

function EmailMismatchState({
  dict,
  lang,
}: {
  dict: Dictionary['invite']
  lang: Locale
}) {
  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
      <h1 className="mb-3 text-2xl font-bold text-green-900">{dict.emailMismatchHeading}</h1>
      <p className="mb-4 text-sm text-gray-600">{dict.emailMismatchMessage}</p>
      <Link
        href={`/${lang}/login`}
        className="text-sm font-medium text-green-700 underline hover:text-green-800"
      >
        {dict.logoutLink}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login prompt (user exists, no session)
// ---------------------------------------------------------------------------

function LoginPromptState({
  maskedEmail,
  dict,
  lang,
}: {
  maskedEmail: string
  dict: Dictionary['invite']
  lang: Locale
}) {
  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
      <h1 className="mb-2 text-2xl font-bold text-green-900">{dict.loginHeading}</h1>
      <p className="mb-1 text-sm text-gray-500">{dict.loginSubtitle}</p>
      <p className="mb-6 text-sm font-medium text-green-700">{maskedEmail}</p>
      <Link
        href={`/${lang}/login`}
        className="flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        {dict.loginHeading}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sign up state (new user) — shows pending state after successful registration
// ---------------------------------------------------------------------------

function SignUpState({
  maskedEmail,
  lang,
  dict,
  pendingApprovalDict,
  acceptAsNewAction,
}: {
  maskedEmail: string
  lang: Locale
  dict: Dictionary['invite']
  pendingApprovalDict: Dictionary['pendingApproval']
  acceptAsNewAction: (password: string) => Promise<AcceptInviteResultWithPending>
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()
  const [showPendingState, setShowPendingState] = useState(false)

  if (showPendingState) {
    return <PendingApprovalInviteState dict={dict} pendingApprovalDict={pendingApprovalDict} lang={lang} />
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    if (password.length < 8) {
      setError(dict.errors.WEAK_PASSWORD)
      return
    }

    if (password !== confirmPassword) {
      setError(dict.errors.WEAK_PASSWORD)
      return
    }

    startTransition(async () => {
      const result = await acceptAsNewAction(password)
      if (result && !result.success) {
        const errKey = result.error as keyof typeof dict.errors
        setError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      } else if (result && result.success && result.pendingApproval) {
        // Show pending approval state — do NOT redirect
        setShowPendingState(true)
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl">
      <h1 className="mb-2 text-2xl font-bold text-green-900">{dict.signupHeading}</h1>
      <p className="mb-1 text-sm text-gray-500">{dict.signupSubtitle}</p>
      <p className="mb-6 text-sm font-medium text-green-700">{maskedEmail}</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="invite-password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {dict.passwordLabel}
          </label>
          <input
            id="invite-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label
            htmlFor="invite-confirm-password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {dict.confirmPasswordLabel}
          </label>
          <input
            id="invite-confirm-password"
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

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
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
              {dict.joining}
            </span>
          ) : (
            dict.joinButton
          )}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending approval state — shown after new-user registration
// ---------------------------------------------------------------------------

function PendingApprovalInviteState({
  dict,
  pendingApprovalDict,
  lang,
}: {
  dict: Dictionary['invite']
  pendingApprovalDict: Dictionary['pendingApproval']
  lang: Locale
}) {
  return (
    <div className="rounded-2xl bg-white px-8 py-10 shadow-xl text-center">
      <div className="mb-4 flex justify-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 text-yellow-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V12.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-green-900">{dict.pendingHeading}</h1>
      <p className="mb-6 text-sm text-gray-600">{dict.pendingMessage}</p>
      <Link
        href={`/${lang}/quinielas`}
        className="inline-block rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        {pendingApprovalDict.backLink}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

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
