'use client'

import { useState, useTransition } from 'react'
import type { PredictionMode } from '@/appSettings/appSettings.types'
import type { Dictionary } from '@/i18n/getDictionary'

type AppSettingsFormProps = {
  initialMode: PredictionMode
  dict: Dictionary['adminSettings']
}

type SaveResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Client form for updating the global app settings (prediction mode).
 * Calls PUT /api/admin/settings directly via fetch — no server action needed
 * since this is an admin-only, infrequent operation.
 */
export default function AppSettingsForm({ initialMode, dict }: AppSettingsFormProps) {
  const [mode, setMode] = useState<PredictionMode>(initialMode)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictionMode: mode }),
        })
        const data = (await res.json()) as SaveResult
        setResult(data)
      } catch {
        setResult({ success: false, error: 'UNKNOWN_ERROR' })
      }
    })
  }

  const errorKey = result !== null && !result.success ? result.error : null
  const errorMessage =
    errorKey !== null
      ? (dict.errors[errorKey as keyof typeof dict.errors] ?? dict.errors.UNKNOWN_ERROR)
      : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700">{dict.predictionModeLabel}</legend>

        <div className="mt-3 flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="predictionMode"
              value="shared"
              checked={mode === 'shared'}
              onChange={() => setMode('shared')}
              className="mt-0.5 h-4 w-4 accent-green-700"
            />
            <span className="text-sm text-gray-800">{dict.predictionModeShared}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="predictionMode"
              value="per_quiniela"
              checked={mode === 'per_quiniela'}
              onChange={() => setMode('per_quiniela')}
              className="mt-0.5 h-4 w-4 accent-green-700"
            />
            <span className="text-sm text-gray-800">{dict.predictionModePerQuiniela}</span>
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          {isPending ? dict.saving : dict.saveButton}
        </button>

        {result !== null && result.success && (
          <p role="status" className="text-sm text-green-700">
            {dict.saveSuccess}
          </p>
        )}
      </div>

      {errorMessage !== null && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </form>
  )
}
