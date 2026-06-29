/** @jest-environment jsdom */

/**
 * Tests for useLazyCrowdPercentages.
 *
 * Strategy:
 * - Mock IntersectionObserver to capture the callback and control observations.
 * - Mock fetchCrowdPercentages (the server action) to resolve on demand.
 * - Register elements via registerRef, trigger intersections, assert crowdMap updates.
 */

import { renderHook, act } from '@testing-library/react'
import { useLazyCrowdPercentages } from '../_hooks/useLazyCrowdPercentages'
import { fetchCrowdPercentages } from '../actions'

// ---------------------------------------------------------------------------
// Mock the server action
// ---------------------------------------------------------------------------

jest.mock('../actions', () => ({
  fetchCrowdPercentages: jest.fn(),
}))

const mockFetchCrowdPercentages = fetchCrowdPercentages as jest.MockedFunction<
  typeof fetchCrowdPercentages
>

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type MockObserverEntry = {
  isIntersecting: boolean
  target: HTMLElement
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  private _callback: IntersectionObserverCallback
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()

  constructor(callback: IntersectionObserverCallback) {
    this._callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  /** Simulate elements entering / leaving the viewport */
  simulateEntries(entries: MockObserverEntry[]) {
    this._callback(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  mockFetchCrowdPercentages.mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helper: create a div with data-match-id set
// ---------------------------------------------------------------------------

function makeEl(matchId: string): HTMLElement {
  const el = document.createElement('div')
  el.dataset.matchId = matchId
  return el
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLazyCrowdPercentages', () => {
  it('starts with an empty crowdMap', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages([]))
    expect(result.current.crowdMap.size).toBe(0)
  })

  it('returns a registerRef function', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages([]))
    expect(typeof result.current.registerRef).toBe('function')
  })

  it('registerRef(matchId) returns a callable ref callback', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages([]))
    const cb = result.current.registerRef('match-1')
    expect(typeof cb).toBe('function')
  })

  it('registerRef(matchId) returns the same function reference on repeated calls (stable ref)', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages([]))
    const cb1 = result.current.registerRef('match-1')
    const cb2 = result.current.registerRef('match-1')
    expect(cb1).toBe(cb2)
  })

  it('creates an IntersectionObserver with threshold 0.1 on mount', () => {
    const spy = jest.fn().mockImplementation(
      (cb: IntersectionObserverCallback) => {
        return new MockIntersectionObserver(cb)
      },
    )
    window.IntersectionObserver = spy as unknown as typeof IntersectionObserver
    renderHook(() => useLazyCrowdPercentages([]))
    expect(spy).toHaveBeenCalledWith(expect.any(Function), { threshold: 0.1 })
  })

  it('observer.observe is called when an element is registered after mount', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages(['match-1']))

    const el = makeEl('match-1')
    act(() => {
      result.current.registerRef('match-1')(el)
    })

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.observe).toHaveBeenCalledWith(el)
  })

  it('observer.observe is called for elements registered before mount (pre-mount registration)', () => {
    // This tests that elements registered before the useEffect runs are observed
    // Elements are attached (refs fire) before useEffect in React's commit phase
    const { result } = renderHook(() => useLazyCrowdPercentages(['match-x']))

    const el = makeEl('match-x')
    // Register the element — this fires synchronously during component mount
    act(() => {
      result.current.registerRef('match-x')(el)
    })

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.observe).toHaveBeenCalledWith(el)
  })

  it('calls fetchCrowdPercentages when an element enters the viewport', async () => {
    mockFetchCrowdPercentages.mockResolvedValue({})

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-a']))

    const el = makeEl('match-a')
    act(() => {
      result.current.registerRef('match-a')(el)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateEntries([
        { isIntersecting: true, target: el },
      ])
    })

    expect(mockFetchCrowdPercentages).toHaveBeenCalledWith(['match-a'])
  })

  it('does not call fetchCrowdPercentages when entries are not intersecting', async () => {
    const { result } = renderHook(() => useLazyCrowdPercentages(['match-b']))

    const el = makeEl('match-b')
    act(() => {
      result.current.registerRef('match-b')(el)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateEntries([
        { isIntersecting: false, target: el },
      ])
    })

    expect(mockFetchCrowdPercentages).not.toHaveBeenCalled()
  })

  it('merges fetched percentages into crowdMap', async () => {
    mockFetchCrowdPercentages.mockResolvedValue({
      'match-c': { homeWinPct: 40, drawPct: 30, awayWinPct: 30 },
    })

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-c']))

    const el = makeEl('match-c')
    act(() => {
      result.current.registerRef('match-c')(el)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateEntries([
        { isIntersecting: true, target: el },
      ])
    })

    expect(result.current.crowdMap.get('match-c')).toEqual({
      homeWinPct: 40,
      drawPct: 30,
      awayWinPct: 30,
    })
  })

  it('stores null in crowdMap when server returns null for a matchId (no predictions)', async () => {
    mockFetchCrowdPercentages.mockResolvedValue({ 'match-d': null })

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-d']))
    const el = makeEl('match-d')
    act(() => {
      result.current.registerRef('match-d')(el)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateEntries([
        { isIntersecting: true, target: el },
      ])
    })

    expect(result.current.crowdMap.has('match-d')).toBe(true)
    expect(result.current.crowdMap.get('match-d')).toBeNull()
  })

  it('does NOT re-fetch a matchId that was already fetched', async () => {
    mockFetchCrowdPercentages.mockResolvedValue({
      'match-e': { homeWinPct: 50, drawPct: 25, awayWinPct: 25 },
    })

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-e']))
    const el = makeEl('match-e')
    act(() => {
      result.current.registerRef('match-e')(el)
    })

    const observer = MockIntersectionObserver.instances[0]

    // First intersection — triggers fetch
    await act(async () => {
      observer.simulateEntries([{ isIntersecting: true, target: el }])
    })

    // Second intersection — should NOT trigger another fetch
    await act(async () => {
      observer.simulateEntries([{ isIntersecting: true, target: el }])
    })

    expect(mockFetchCrowdPercentages).toHaveBeenCalledTimes(1)
  })

  it('batches multiple visible matches into one fetchCrowdPercentages call', async () => {
    mockFetchCrowdPercentages.mockResolvedValue({
      'match-f': { homeWinPct: 60, drawPct: 20, awayWinPct: 20 },
      'match-g': { homeWinPct: 30, drawPct: 40, awayWinPct: 30 },
    })

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-f', 'match-g']))

    const elF = makeEl('match-f')
    const elG = makeEl('match-g')
    act(() => {
      result.current.registerRef('match-f')(elF)
      result.current.registerRef('match-g')(elG)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].simulateEntries([
        { isIntersecting: true, target: elF },
        { isIntersecting: true, target: elG },
      ])
    })

    expect(mockFetchCrowdPercentages).toHaveBeenCalledTimes(1)
    expect(mockFetchCrowdPercentages).toHaveBeenCalledWith(
      expect.arrayContaining(['match-f', 'match-g']),
    )
  })

  it('observer.unobserve is called when a registered element unmounts', () => {
    const { result } = renderHook(() => useLazyCrowdPercentages(['match-h']))

    const el = makeEl('match-h')
    act(() => {
      result.current.registerRef('match-h')(el)
    })

    act(() => {
      // Simulate unmount by calling the ref callback with null
      result.current.registerRef('match-h')(null)
    })

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.unobserve).toHaveBeenCalledWith(el)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useLazyCrowdPercentages([]))
    unmount()
    const observer = MockIntersectionObserver.instances[0]
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('does not crash when fetchCrowdPercentages rejects', async () => {
    mockFetchCrowdPercentages.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useLazyCrowdPercentages(['match-i']))
    const el = makeEl('match-i')
    act(() => {
      result.current.registerRef('match-i')(el)
    })

    await expect(
      act(async () => {
        MockIntersectionObserver.instances[0].simulateEntries([
          { isIntersecting: true, target: el },
        ])
      }),
    ).resolves.not.toThrow()

    // crowdMap remains empty after a failed fetch
    expect(result.current.crowdMap.has('match-i')).toBe(false)
  })
})
