import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchCrowdPercentages } from '../actions'
import type { CrowdPercentages } from '@/scoring/scoring.types'

export type UseLazyCrowdPercentagesReturn = {
  crowdMap: Map<string, CrowdPercentages | null>
  registerRef: (matchId: string) => (el: HTMLElement | null) => void
}

/**
 * Lazily fetches crowd-prediction percentages as match card wrappers scroll
 * into the viewport.
 *
 * Uses a single IntersectionObserver (threshold 0.1) to watch elements
 * registered via `registerRef`. When new elements become visible their match
 * IDs are batched and sent to `fetchCrowdPercentages` in one call. Results
 * are merged into the returned `crowdMap`.
 *
 * @param allMatchIds - All match IDs on the page. Accepted as part of the
 *   public API surface; the hook is driven by IntersectionObserver callbacks
 *   through `registerRef`, not by this list directly.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useLazyCrowdPercentages(_allMatchIds: string[]): UseLazyCrowdPercentagesReturn {
  const [crowdMap, setCrowdMap] = useState<Map<string, CrowdPercentages | null>>(new Map())

  /** Match IDs already fetched (or currently in-flight) — prevents double-fetching */
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  /** Map from matchId to its registered wrapper element */
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map())

  /** The single IntersectionObserver instance (set after mount) */
  const observerRef = useRef<IntersectionObserver | null>(null)

  /**
   * Stable ref callbacks keyed by matchId.
   * Caching ensures the same function reference is returned for the same
   * matchId on every render, so React never unnecessarily cleans up and
   * reattaches refs.
   */
  const refCallbacksRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const newIds: string[] = []
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const matchId = (entry.target as HTMLElement).dataset.matchId
            if (matchId && !fetchedIdsRef.current.has(matchId)) {
              newIds.push(matchId)
            }
          }
        }
        if (newIds.length === 0) return

        // Mark as in-flight BEFORE the async call to prevent duplicate requests
        for (const id of newIds) {
          fetchedIdsRef.current.add(id)
        }

        fetchCrowdPercentages(newIds)
          .then((result) => {
            setCrowdMap((prev) => {
              const next = new Map(prev)
              for (const [matchId, pct] of Object.entries(result)) {
                next.set(matchId, pct)
              }
              return next
            })
          })
          .catch(() => {
            // Crowd data is non-critical — fail silently.
            // IDs remain in fetchedIdsRef to avoid retry-flooding on errors.
          })
      },
      { threshold: 0.1 },
    )

    observerRef.current = observer

    // Observe elements that were registered before this effect ran
    // (refs attach before effects in React's commit phase)
    for (const [, el] of elementsRef.current) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [])

  const registerRef = useCallback((matchId: string) => {
    if (!refCallbacksRef.current.has(matchId)) {
      refCallbacksRef.current.set(matchId, (el: HTMLElement | null) => {
        if (el === null) {
          const existing = elementsRef.current.get(matchId)
          if (existing) {
            observerRef.current?.unobserve(existing)
          }
          elementsRef.current.delete(matchId)
          // Clear the cache entry so the next mount creates a fresh callback
          refCallbacksRef.current.delete(matchId)
          return
        }
        elementsRef.current.set(matchId, el)
        observerRef.current?.observe(el)
      })
    }
    return refCallbacksRef.current.get(matchId)!
  }, [])

  return { crowdMap, registerRef }
}
