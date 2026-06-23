/** @jest-environment jsdom */

/**
 * Tests for useLastFinishedMatchVisibility.
 *
 * Visibility is recomputed from getBoundingClientRect on scroll/resize
 * (rAF-throttled), so we stub window.innerHeight, the element's
 * getBoundingClientRect, and requestAnimationFrame to run synchronously.
 */

import { renderHook, act } from '@testing-library/react'
import { useLastFinishedMatchVisibility } from '../_hooks/useLastFinishedMatchVisibility'

function makeElement(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = jest.fn(() => rect as DOMRect)
  return el
}

beforeEach(() => {
  window.innerHeight = 800
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useLastFinishedMatchVisibility', () => {
  it('starts with showButton false before any element is attached', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())
    expect(result.current.showButton).toBe(false)
  })

  it('does not show the button when attaching null', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(null)
    })

    expect(result.current.showButton).toBe(false)
  })

  it('shows the button when the target is below the viewport', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(makeElement({ top: 1000, bottom: 1100 }))
    })

    expect(result.current.showButton).toBe(true)
  })

  it('hides the button when the target is on-screen', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(makeElement({ top: 100, bottom: 200 }))
    })

    expect(result.current.showButton).toBe(false)
  })

  it('hides the button when the target has been scrolled past', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(makeElement({ top: -200, bottom: -100 }))
    })

    expect(result.current.showButton).toBe(false)
  })

  it('recomputes on scroll events', () => {
    const el = makeElement({ top: 1000, bottom: 1100 })
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(el)
    })
    expect(result.current.showButton).toBe(true)

    el.getBoundingClientRect = jest.fn(() => ({ top: 100, bottom: 200 }) as DOMRect)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.showButton).toBe(false)
  })

  it('removes scroll/resize listeners when attaching a new element', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener')
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    act(() => {
      result.current.setTargetElement(makeElement({ top: 1000, bottom: 1100 }))
    })
    act(() => {
      result.current.setTargetElement(makeElement({ top: 1000, bottom: 1100 }))
    })

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('scrollToTarget calls scrollIntoView on the attached node', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())
    const el = makeElement({ top: 1000, bottom: 1100 })
    el.scrollIntoView = jest.fn()

    act(() => {
      result.current.setTargetElement(el)
    })

    act(() => {
      result.current.scrollToTarget()
    })

    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('scrollToTarget is a no-op when there is no attached node', () => {
    const { result } = renderHook(() => useLastFinishedMatchVisibility())

    expect(() => {
      act(() => {
        result.current.scrollToTarget()
      })
    }).not.toThrow()
  })
})
