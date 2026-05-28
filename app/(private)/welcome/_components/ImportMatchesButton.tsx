'use client'

import { useState, useTransition } from 'react'
import { importWorldCupMatches } from '@/app/(private)/welcome/actions'
import type { ImportMatchesResult } from '@/competitions/competitions.types'

type ImportMatchesButtonProps = {
  userRole: 'admin' | 'player'
}

type ImportErrorCode = 'FETCH_FAILED' | 'DB_ERROR' | 'UNKNOWN_ERROR'

function getErrorMessage(error: ImportErrorCode): string {
  switch (error) {
    case 'FETCH_FAILED':
      return 'Failed to fetch matches from the external source. Please try again later.'
    case 'DB_ERROR':
      return 'A database error occurred while saving matches. Please try again.'
    case 'UNKNOWN_ERROR':
    default:
      return 'An unexpected error occurred. Please try again.'
  }
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

export default function ImportMatchesButton({ userRole }: ImportMatchesButtonProps) {
  if (userRole !== 'admin') return null

  return <ImportMatchesButtonInner />
}

function ImportMatchesButtonInner() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportMatchesResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await importWorldCupMatches()
      setResult(res)
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
            Importing…
          </span>
        ) : (
          'Import World Cup Matches'
        )}
      </button>

      {result !== null && result.success && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Imported {result.count} match{result.count === 1 ? '' : 'es'} successfully.
        </p>
      )}

      {result !== null && !result.success && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(result.error)}
        </p>
      )}
    </div>
  )
}
