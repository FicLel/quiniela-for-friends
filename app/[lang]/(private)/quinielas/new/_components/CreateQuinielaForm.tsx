'use client'

import { useState, useTransition } from 'react'
import type { Dictionary } from '@/i18n/getDictionary'
import type { CreateQuinielaResult } from '@/quinielas/quinielas.types'

type Props = {
  dict: Dictionary['quinielas']
  createAction: (name: string) => Promise<CreateQuinielaResult>
}

export default function CreateQuinielaForm({ dict, createAction }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    if (!name.trim()) {
      setError(dict.errors.NAME_EMPTY)
      return
    }

    startTransition(async () => {
      const result = await createAction(name)
      if (result && !result.success) {
        const errKey = result.error as keyof typeof dict.errors
        setError(dict.errors[errKey] ?? dict.errors.UNKNOWN_ERROR)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="mb-6 text-2xl font-bold text-green-900">{dict.createNew}</h1>

      <div className="mb-4">
        <label htmlFor="quiniela-name" className="mb-1.5 block text-sm font-medium text-gray-700">
          {dict.nameLabel}
        </label>
        <input
          id="quiniela-name"
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
          placeholder={dict.namePlaceholder}
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
            {dict.creating}
          </span>
        ) : (
          dict.createButton
        )}
      </button>
    </form>
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
