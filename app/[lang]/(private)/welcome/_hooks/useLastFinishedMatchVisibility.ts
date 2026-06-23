import { useCallback, useRef, useState } from 'react'

export type UseLastFinishedMatchVisibilityReturn = {
  setTargetElement: (el: HTMLElement | null) => void
  showButton: boolean
  scrollToTarget: () => void
}

/**
 * Tracks the on-screen position of a single DOM node (the last finished
 * match card) on scroll/resize, and exposes whether a "jump to it" button
 * should be shown plus a function to scroll to it.
 *
 * Recomputes via getBoundingClientRect on every scroll/resize (rAF-throttled)
 * rather than IntersectionObserver, since threshold-crossing observers can
 * get stuck if a layout shift causes the first read to land on the wrong
 * side with the ratio never crossing 0% again on subsequent scrolling.
 *
 * Show/hide rules:
 * - Target on-screen (top < viewportHeight && bottom > 0) -> hide.
 * - Target scrolled past (bottom <= 0) -> hide.
 * - Target still below the viewport (top >= viewportHeight) -> show.
 */
export function useLastFinishedMatchVisibility(): UseLastFinishedMatchVisibilityReturn {
  const [showButton, setShowButton] = useState(false)
  const nodeRef = useRef<HTMLElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const rafIdRef = useRef<number | null>(null)

  const setTargetElement = useCallback((el: HTMLElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    nodeRef.current = el

    if (el === null) {
      setShowButton(false)
      return
    }

    const recompute = () => {
      rafIdRef.current = null
      const rect = el.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      if (rect.bottom <= 0 || rect.top < viewportHeight) {
        setShowButton(false)
        return
      }
      setShowButton(true)
    }

    const scheduleRecompute = () => {
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(recompute)
    }

    window.addEventListener('scroll', scheduleRecompute, { passive: true })
    window.addEventListener('resize', scheduleRecompute)
    recompute()

    cleanupRef.current = () => {
      window.removeEventListener('scroll', scheduleRecompute)
      window.removeEventListener('resize', scheduleRecompute)
    }
  }, [])

  const scrollToTarget = useCallback(() => {
    nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return { setTargetElement, showButton, scrollToTarget }
}
