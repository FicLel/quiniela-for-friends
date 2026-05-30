'use client'

import { useState, useTransition } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { MemberWithUser, MembershipRole } from '@/memberships/memberships.types'
import type { InvitationWithStatus } from '@/invitations/invitations.types'
import type { SendInviteResult, RevokeInviteResult } from '@/invitations/invitations.types'
import type { RemoveMemberResult, LeaveQuinielaResult, ApproveMemberResult } from '@/memberships/memberships.types'

type Props = {
  members: MemberWithUser[]
  invitations: InvitationWithStatus[]
  callerMembership: { role: MembershipRole; membershipId: string }
  quinielaId: string
  lang: Locale
  dict: Dictionary['members']
  inviteMemberAction: (roleToAssign: 'admin' | 'member') => Promise<SendInviteResult>
  removeMemberAction: (targetMembershipId: string) => Promise<RemoveMemberResult>
  revokeInviteAction: (invitationId: string) => Promise<RevokeInviteResult>
  leaveQuinielaAction: () => Promise<LeaveQuinielaResult>
  approveMemberAction?: (membershipId: string) => Promise<ApproveMemberResult>
}


export default function MembersClient({
  members: initialMembers,
  invitations: initialInvitations,
  callerMembership,
  dict,
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  leaveQuinielaAction,
  approveMemberAction,
}: Props) {
  const isAdmin = callerMembership.role === 'admin'

  // Members list state (for optimistic approve updates)
  const [members, setMembers] = useState(initialMembers)
  const [approvingMembershipId, setApprovingMembershipId] = useState<string | undefined>(undefined)
  const [approveError, setApproveError] = useState<string | undefined>(undefined)
  const [isApproving, startApproveTransition] = useTransition()

  // Invite form state
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteError, setInviteError] = useState<string | undefined>(undefined)
  const [generatedUrl, setGeneratedUrl] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [isInviting, startInviteTransition] = useTransition()

  // Members list state
  const [memberError, setMemberError] = useState<string | undefined>(undefined)
  const [removingId, setRemovingId] = useState<string | undefined>(undefined)
  const [isRemoving, startRemoveTransition] = useTransition()

  // Invitations list state
  const [invitations, setInvitations] = useState(initialInvitations)
  const [revokeError, setRevokeError] = useState<string | undefined>(undefined)
  const [revokingId, setRevokingId] = useState<string | undefined>(undefined)
  const [isRevoking, startRevokeTransition] = useTransition()

  // Leave state
  const [leaveError, setLeaveError] = useState<string | undefined>(undefined)
  const [isLeaving, startLeaveTransition] = useTransition()

  function handleInviteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setInviteError(undefined)
    setGeneratedUrl(undefined)

    startInviteTransition(async () => {
      const result = await inviteMemberAction(inviteRole)
      if (result.success) {
        setGeneratedUrl(result.inviteUrl)
      } else {
        const errKey = result.error as keyof typeof dict.errors
        setInviteError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  function handleCopyLink() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRemoveMember(membershipId: string) {
    if (!window.confirm(dict.confirmRemove)) return
    setMemberError(undefined)
    setRemovingId(membershipId)

    startRemoveTransition(async () => {
      const result = await removeMemberAction(membershipId)
      setRemovingId(undefined)
      if (!result.success) {
        const errKey = result.error as keyof typeof dict.errors
        setMemberError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  function handleRevokeInvite(invitationId: string) {
    setRevokeError(undefined)
    setRevokingId(invitationId)

    startRevokeTransition(async () => {
      const result = await revokeInviteAction(invitationId)
      setRevokingId(undefined)
      if (result.success) {
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === invitationId ? { ...inv, status: 'revoked' as const } : inv,
          ),
        )
      } else {
        const errKey = result.error as keyof typeof dict.errors
        setRevokeError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  function handleLeaveQuiniela() {
    if (!window.confirm(dict.confirmLeave)) return
    setLeaveError(undefined)

    startLeaveTransition(async () => {
      const result = await leaveQuinielaAction()
      if (result && !result.success) {
        const errKey = result.error as keyof typeof dict.errors
        setLeaveError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  function handleApproveMember(membershipId: string) {
    if (!approveMemberAction) return
    setApproveError(undefined)
    setApprovingMembershipId(membershipId)

    startApproveTransition(async () => {
      const result = await approveMemberAction(membershipId)
      setApprovingMembershipId(undefined)
      if (result.ok) {
        // Optimistically flip badge to approved
        setMembers((prev) =>
          prev.map((m) =>
            m.membershipId === membershipId ? { ...m, approvedAt: new Date() } : m,
          ),
        )
      } else {
        setApproveError(dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Members list */}
      <section className="rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-green-900">{dict.heading}</h1>

        {memberError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {memberError}
          </p>
        )}

        {approveError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {approveError}
          </p>
        )}

        <ul className="divide-y divide-gray-100">
          {members.map((member) => {
            const isPending = member.approvedAt === null
            const canRemove =
              isAdmin &&
              member.role !== 'admin' &&
              member.membershipId !== callerMembership.membershipId
            const canApprove = isAdmin && isPending && !!approveMemberAction

            return (
              <li key={member.membershipId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{member.email}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'admin'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.role === 'admin' ? dict.roleAdmin : dict.roleMember}
                  </span>
                  {isPending && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {dict.statusPending}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canApprove && (
                    <button
                      type="button"
                      disabled={isApproving && approvingMembershipId === member.membershipId}
                      onClick={() => handleApproveMember(member.membershipId)}
                      className="rounded-lg border border-green-200 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dict.approveButton ?? 'Approve'}
                    </button>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      disabled={isRemoving && removingId === member.membershipId}
                      onClick={() => handleRemoveMember(member.membershipId)}
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dict.removeMember}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Invite form — admins only */}
      {isAdmin && (
        <section className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-green-900">{dict.inviteMember}</h2>

          <form onSubmit={handleInviteSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="invite-role"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {dict.roleLabel}
              </label>
              <select
                id="invite-role"
                name="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                disabled={isInviting}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="member">{dict.roleMember}</option>
                <option value="admin">{dict.roleAdmin}</option>
              </select>
            </div>

            {inviteError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {inviteError}
              </p>
            )}

            <button
              type="submit"
              disabled={isInviting}
              className="flex items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
            >
              {isInviting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  {dict.inviting}
                </span>
              ) : (
                dict.inviteButton
              )}
            </button>
          </form>

          {/* Generated invite link */}
          {generatedUrl && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="mb-2 break-all text-xs text-green-800">{generatedUrl}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
              >
                {copied ? dict.linkCopied : dict.copyLink}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Active invite links — admins only */}
      {isAdmin && pendingInvitations.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-green-900">{dict.activeInviteLink ?? dict.pendingInvites}</h2>

          {revokeError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {revokeError}
            </p>
          )}

          <ul className="divide-y divide-gray-100">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-mono text-gray-700">
                  {inv.shortCode ? `…/invite/${inv.shortCode}` : (inv.email ?? '—')}
                </span>
                <button
                  type="button"
                  disabled={isRevoking && revokingId === inv.id}
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {dict.revokeInvite}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Leave quiniela — admins only */}
      {isAdmin && (
        <section className="rounded-2xl bg-white p-6 shadow-lg">
          {leaveError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {leaveError}
            </p>
          )}
          <button
            type="button"
            disabled={isLeaving}
            onClick={handleLeaveQuiniela}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dict.leaveQuiniela}
          </button>
        </section>
      )}
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
