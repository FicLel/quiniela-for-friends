/** @jest-environment jsdom */

/**
 * Tests for useQuinielaSwitcher hook.
 *
 * The hook reads `?quiniela=<uuid>` from the current URL via `useSearchParams`
 * and writes back to the URL via `router.replace` on select().
 *
 * next/navigation is mocked so we can control the search-params state without
 * a full Next.js render cycle.
 */

import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = jest.fn()
let mockSearchParamsValue: URLSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParamsValue,
}))

// Import after mock registration
import { useQuinielaSwitcher } from '../_hooks/useQuinielaSwitcher'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSearchParams(params: Record<string, string>) {
  mockSearchParamsValue = new URLSearchParams(params)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParamsValue = new URLSearchParams()
})

describe('useQuinielaSwitcher', () => {
  it('returns defaultId as selectedId when ?quiniela param is absent', () => {
    setSearchParams({})
    const { result } = renderHook(() => useQuinielaSwitcher('quiniela-1'))
    expect(result.current.selectedId).toBe('quiniela-1')
  })

  it('returns the ?quiniela param value as selectedId when present', () => {
    setSearchParams({ quiniela: 'quiniela-2' })
    const { result } = renderHook(() => useQuinielaSwitcher('quiniela-1'))
    expect(result.current.selectedId).toBe('quiniela-2')
  })

  it('calls router.replace with updated ?quiniela param on select()', () => {
    setSearchParams({ view: 'date' })
    const { result } = renderHook(() => useQuinielaSwitcher('quiniela-1'))

    act(() => {
      result.current.select('quiniela-3')
    })

    expect(mockReplace).toHaveBeenCalledTimes(1)
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('quiniela=quiniela-3')
    // Existing params must be preserved
    expect(calledUrl).toContain('view=date')
  })

  it('calls router.replace with scroll: false option', () => {
    setSearchParams({})
    const { result } = renderHook(() => useQuinielaSwitcher('quiniela-1'))

    act(() => {
      result.current.select('quiniela-x')
    })

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('quiniela=quiniela-x'),
      { scroll: false },
    )
  })

  it('overwrites an existing ?quiniela param on select()', () => {
    setSearchParams({ quiniela: 'quiniela-old' })
    const { result } = renderHook(() => useQuinielaSwitcher('quiniela-1'))

    act(() => {
      result.current.select('quiniela-new')
    })

    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('quiniela=quiniela-new')
    expect(calledUrl).not.toContain('quiniela=quiniela-old')
  })
})
