'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export type UseQuinielaSwitcherReturn = {
  selectedId: string
  select: (id: string) => void
}

/**
 * Manages the active quiniela selection via the `?quiniela=<uuid>` URL search param.
 *
 * - On mount: if `?quiniela` is absent or does not match a known quiniela id,
 *   callers should pass `defaultId` (the first quiniela in the list) and use it
 *   to render the initial selection without triggering a navigation.
 * - `select(id)`: calls `router.replace` with the updated param (shallow, no scroll).
 *
 * @param defaultId - The id to use when no `?quiniela` param is present.
 */
export function useQuinielaSwitcher(defaultId: string): UseQuinielaSwitcherReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  const paramValue = searchParams.get('quiniela')
  const selectedId = paramValue ?? defaultId

  const select = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('quiniela', id)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  return { selectedId, select }
}
