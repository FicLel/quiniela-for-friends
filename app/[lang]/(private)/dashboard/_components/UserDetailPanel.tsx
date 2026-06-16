'use client'

import { useState, useTransition } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { UserWithMemberships } from '@/users/users.types'
import type { ApproveMemberResult } from '@/memberships/memberships.types'
import type { CreateResetTokenResult } from '@/auth/auth.types'

type Membership = UserWithMemberships['memberships'][number]

type Props = {
  user: UserWithMemberships
  dict: Dictionary['users']
  approveAction: (membershipId: string) => Promise<ApproveMemberResult>
  generateResetLinkAction: (userId: string) => Promise<CreateResetTokenResult>
  onClose: () => void
}

/**
 * Slide-in panel showing user details: email, list of quinielas with role,
 * joined date, and approval status. Admins can approve pending memberships.
 */
export default function UserDetailPanel({ user, dict, approveAction, generateResetLinkAction, onClose }: Props) {
  const [memberships, setMemberships] = useState<Membership[]>(user.memberships)
  const [approvingId, setApprovingId] = useState<string | undefined>(undefined)
  const [approveError, setApproveError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  const [resetLinkState, setResetLinkState] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle')

  function handleGenerateResetLink() {
    setResetLinkState('pending')
    startTransition(async () => {
      const result = await generateResetLinkAction(user.id)
      if (result.success) {
        await navigator.clipboard.writeText(result.resetUrl)
        setResetLinkState('copied')
        setTimeout(() => setResetLinkState('idle'), 3000)
      } else {
        setResetLinkState('error')
        setTimeout(() => setResetLinkState('idle'), 4000)
      }
    })
  }

  function handleApprove(membership: Membership) {
    setApproveError(undefined)
    setApprovingId(membership.membershipId)

    startTransition(async () => {
      const result = await approveAction(membership.membershipId)
      setApprovingId(undefined)
      if (result.ok) {
        // Optimistically update badge
        setMemberships((prev) =>
          prev.map((m) =>
            m.membershipId === membership.membershipId
              ? { ...m, approvedAt: new Date() }
              : m,
          ),
        )
      } else {
        setApproveError(dict.errorState)
      }
    })
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={dict.detailHeading}
    >
      {/* Panel */}
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl sm:w-md">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-green-900">{dict.detailHeading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Email */}
          <p className="mb-4 text-base font-medium text-gray-900">{user.email}</p>

          {/* Reset link */}
          <div className="mb-6">
            <button
              type="button"
              disabled={resetLinkState === 'pending'}
              onClick={handleGenerateResetLink}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetLinkState === 'pending' ? dict.generatingResetLink : dict.resetLinkButton}
            </button>
            {resetLinkState === 'copied' && (
              <span className="ml-3 text-xs font-medium text-green-700">{dict.resetLinkCopied}</span>
            )}
            {resetLinkState === 'error' && (
              <span className="ml-3 text-xs text-red-600">{dict.resetLinkError}</span>
            )}
          </div>

          {approveError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {approveError}
            </p>
          )}

          {/* Memberships */}
          {memberships.length === 0 ? (
            <p className="text-sm text-gray-500">{dict.emptyState}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {memberships.map((m) => {
                const isPendingMembership = m.approvedAt === null
                const isApproving = isPending && approvingId === m.membershipId

                return (
                  <li key={m.membershipId} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {m.quinielaName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {/* Role */}
                          <span className="text-xs text-gray-500">
                            {dict.detailQuinielaRole}:{' '}
                            <span className="font-medium text-gray-700">{m.role}</span>
                          </span>
                          {/* Approval status badge */}
                          {isPendingMembership ? (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                              {dict.badgePending}
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              {dict.badgeActive}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Approve button — only for pending memberships */}
                      {isPendingMembership && (
                        <button
                          type="button"
                          disabled={isApproving}
                          onClick={() => handleApprove(m)}
                          className="shrink-0 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-green-400"
                        >
                          {isApproving ? dict.approving : dict.approveButton}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
