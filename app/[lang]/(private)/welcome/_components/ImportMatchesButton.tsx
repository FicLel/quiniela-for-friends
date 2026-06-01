'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importWorldCupMatches, seedKnockoutPlaceholders, syncKnockoutMatches } from '../actions'
import type { ImportMatchesResult, SeedPlaceholdersResult } from '@/competitions/competitions.types'
import type { Dictionary } from '@/i18n/getDictionary'

type ImportMatchesButtonProps = {
  userRole: 'admin' | 'player'
  dict: Dictionary['welcome']
}

type ImportErrorCode = 'FETCH_FAILED' | 'DB_ERROR' | 'UNKNOWN_ERROR'

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

export default function ImportMatchesButton({ userRole, dict }: ImportMatchesButtonProps) {
  if (userRole !== 'admin') return null
  return (
    <div className="flex flex-col gap-4">
      <ImportMatchesButtonInner dict={dict} />
      <SeedPlaceholdersButtonInner dict={dict} />
      <SyncKnockoutButtonInner dict={dict} />
    </div>
  )
}

function ImportMatchesButtonInner({ dict }: { dict: Dictionary['welcome'] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportMatchesResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await importWorldCupMatches()
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400 sm:w-auto"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner />
            {dict.importing}
          </span>
        ) : (
          dict.importButton
        )}
      </button>

      {result !== null && result.success && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {dict.importSuccess.replace('{count}', String(result.count))}
        </p>
      )}

      {result !== null && !result.success && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.importErrors[result.error as ImportErrorCode] ?? dict.importErrors.UNKNOWN_ERROR}
        </p>
      )}
    </div>
  )
}

type SeedErrorCode = 'DB_ERROR' | 'UNKNOWN_ERROR'

function SeedPlaceholdersButtonInner({ dict }: { dict: Dictionary['welcome'] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SeedPlaceholdersResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await seedKnockoutPlaceholders()
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 sm:w-auto"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner />
            {dict.seedingPlaceholders}
          </span>
        ) : (
          dict.seedPlaceholdersButton
        )}
      </button>

      {result !== null && result.success && (
        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {dict.seedPlaceholdersSuccess.replace('{count}', String(result.count))}
        </p>
      )}

      {result !== null && !result.success && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.importErrors[result.error as SeedErrorCode] ?? dict.importErrors.UNKNOWN_ERROR}
        </p>
      )}
    </div>
  )
}

function SyncKnockoutButtonInner({ dict }: { dict: Dictionary['welcome'] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportMatchesResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await syncKnockoutMatches()
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-amber-400 sm:w-auto"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner />
            {dict.syncingKnockout}
          </span>
        ) : (
          dict.syncKnockoutButton
        )}
      </button>

      {result !== null && result.success && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {dict.syncKnockoutSuccess.replace('{count}', String(result.count))}
        </p>
      )}

      {result !== null && !result.success && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.importErrors[result.error as ImportErrorCode] ?? dict.importErrors.UNKNOWN_ERROR}
        </p>
      )}
    </div>
  )
}
