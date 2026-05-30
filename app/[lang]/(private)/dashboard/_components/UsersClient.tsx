'use client'

import { useState, useEffect, useTransition, useCallback, useRef } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { UserWithMemberships, UserListFilters, UserListSort, UserListResult } from '@/users/users.types'
import type { ApproveMemberResult } from '@/memberships/memberships.types'
import type { Quiniela } from '@/quinielas/quinielas.types'
import UserDetailPanel from './UserDetailPanel'

const PAGE_SIZE = 20

type SortColumn = 'email' | 'name'
type SortDirection = 'asc' | 'desc'

type Props = {
  initialUsers: UserWithMemberships[]
  initialTotal: number
  quinielas: Quiniela[]
  lang: Locale
  dict: Dictionary['users']
  listUsersAction: (
    filters: UserListFilters,
    page: number,
    sort: UserListSort,
  ) => Promise<UserListResult>
  approveAction: (membershipId: string) => Promise<ApproveMemberResult>
}

function StatusBadge({ isPending, dict }: { isPending: boolean; dict: Dictionary['users'] }) {
  if (isPending) {
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        {dict.badgePending}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      {dict.badgeActive}
    </span>
  )
}

function SortIcon({ column, sort }: { column: SortColumn; sort: UserListSort }) {
  if (sort.column !== column) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="ml-1 inline h-4 w-4 text-gray-400"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 3a.75.75 0 0 1 .55.24l3.25 3.5a.75.75 0 1 1-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 0 1-1.1-1.02l3.25-3.5A.75.75 0 0 1 10 3Zm-3.76 9.2a.75.75 0 0 1 1.06.04l2.7 2.908 2.7-2.908a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 .04-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (sort.direction === 'asc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="ml-1 inline h-4 w-4 text-green-700"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="ml-1 inline h-4 w-4 text-green-700"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z"
        clipRule="evenodd"
      />
    </svg>
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

export default function UsersClient({
  initialUsers,
  initialTotal,
  quinielas,
  dict,
  listUsersAction,
  approveAction,
}: Props) {
  // Table data state
  const [users, setUsers] = useState<UserWithMemberships[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [hasError, setHasError] = useState(false)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending' | ''>('')
  const [quinielaFilter, setQuinielaFilter] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Sort state — default email A→Z
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'email',
    direction: 'asc',
  })

  // Pagination state
  const [page, setPage] = useState(1)

  // UI state
  const [selectedUser, setSelectedUser] = useState<UserWithMemberships | null>(null)
  const [isPending, startTransition] = useTransition()

  // Debounce search input (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchValue)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchValue])

  // Fetch whenever filters/sort/page change
  const fetchUsers = useCallback(() => {
    const filters: UserListFilters = {}
    if (statusFilter) filters.status = statusFilter
    if (quinielaFilter) filters.quinielaId = quinielaFilter
    if (debouncedSearch) filters.search = debouncedSearch

    startTransition(async () => {
      const result = await listUsersAction(filters, page, sort)
      if (result.ok) {
        setUsers(result.users)
        setTotal(result.total)
        setHasError(false)
      } else {
        setHasError(true)
      }
    })
  }, [statusFilter, quinielaFilter, debouncedSearch, sort, page, listUsersAction])

  // Trigger fetch when dependencies change (skip initial render — initialUsers covers it)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchUsers()
  }, [fetchUsers])

  function handleSortColumn(column: SortColumn) {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value as 'active' | 'pending' | '')
    setPage(1)
  }

  function handleQuinielaFilter(value: string) {
    setQuinielaFilter(value)
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchValue(value)
    // page reset happens in the debounce effect
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-sm font-medium text-gray-700">
            {dict.filterStatus}
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">{dict.filterStatusAll}</option>
            <option value="active">{dict.filterStatusActive}</option>
            <option value="pending">{dict.filterStatusPending}</option>
          </select>
        </div>

        {/* Quiniela filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-quiniela" className="text-sm font-medium text-gray-700">
            {dict.filterQuiniela}
          </label>
          <select
            id="filter-quiniela"
            value={quinielaFilter}
            onChange={(e) => handleQuinielaFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">{dict.filterQuinielaAll}</option>
            {quinielas.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex flex-1 items-center gap-2">
          <label htmlFor="filter-search" className="sr-only">
            {dict.searchPlaceholder}
          </label>
          <input
            id="filter-search"
            type="search"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={dict.searchPlaceholder}
            className="w-full min-w-[200px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {/* Loading indicator */}
        {isPending && <LoadingSpinner />}
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto bg-white">
        {hasError ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-4 text-base text-red-700">{dict.errorState}</p>
            <button
              type="button"
              onClick={fetchUsers}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {dict.retryButton}
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="cursor-pointer select-none px-6 py-3 font-semibold text-gray-700 hover:text-green-700"
                  onClick={() => handleSortColumn('email')}
                >
                  {dict.columnEmail}
                  <SortIcon column="email" sort={sort} />
                </th>
                <th scope="col" className="px-6 py-3 font-semibold text-gray-700">
                  {dict.columnStatus}
                </th>
                <th scope="col" className="px-6 py-3 font-semibold text-gray-700">
                  {dict.columnQuinielas}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-base text-gray-500">
                    {dict.emptyState}
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  // A user is "pending" if at least one membership has approvedAt = null
                  // or if they have no approved memberships
                  const hasPendingMembership = user.memberships.some((m) => m.approvedAt === null)
                  const hasApprovedMembership = user.memberships.some((m) => m.approvedAt !== null)
                  const isPendingUser = hasPendingMembership && !hasApprovedMembership

                  return (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="cursor-pointer transition hover:bg-green-50"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedUser(user)
                      }}
                      aria-label={`View details for ${user.email}`}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">{user.email}</td>
                      <td className="px-6 py-3">
                        <StatusBadge isPending={isPendingUser} dict={dict} />
                      </td>
                      <td className="px-6 py-3 text-gray-600">{user.memberships.length}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!hasError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <p className="text-sm text-gray-500">
            {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || isPending}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &larr;
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isPending}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}

      {/* User detail panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          dict={dict}
          approveAction={approveAction}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}
