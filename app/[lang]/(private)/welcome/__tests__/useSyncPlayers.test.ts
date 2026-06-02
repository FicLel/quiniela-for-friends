/** @jest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSyncPlayers } from '../_hooks/useSyncPlayers'

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/** Returns a fake fetch Response with a JSON body. */
function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function jsonError(body: unknown, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const TEAM_IDS = [1, 2, 3]
const SYNC_RUN_ID = 'run-abc'

const defaultSquad = [
  { id: 10, name: 'Player One', position: 'Goalkeeper', shirtNumber: 1 },
  { id: 11, name: 'Player Two', position: 'Defender', shirtNumber: 4 },
]

// ---------------------------------------------------------------------------
// Helper: build a default happy-path fetch mock
// ---------------------------------------------------------------------------

function buildHappyFetch(): jest.Mock {
  return jest.fn().mockImplementation(async (input: string) => {
    if (input === '/api/admin/players/sync/start') {
      return jsonOk({ success: true, syncRunId: SYNC_RUN_ID, teamIds: TEAM_IDS })
    }
    if (typeof input === 'string' && input.startsWith('/api/admin/players/team-detail')) {
      return jsonOk({ success: true, squad: defaultSquad })
    }
    if (input === '/api/admin/players/save-team') {
      return jsonOk({ success: true, playersUpserted: 2 })
    }
    if (input === '/api/admin/players/sync/finish') {
      return jsonOk({ success: true })
    }
    if (input === '/api/admin/players/sync/item-error') {
      return jsonOk({ success: true })
    }
    return jsonError({ success: false, error: 'UNKNOWN_ERROR' }, 500)
  })
}

// ---------------------------------------------------------------------------
// Before/after
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = buildHappyFetch()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helper to run the full async loop with throttle delays
// ---------------------------------------------------------------------------

async function driveLoop(teamCount: number) {
  // Process each team: advance timers and flush promises
  for (let i = 0; i < teamCount; i++) {
    if (i > 0) {
      await act(async () => {
        jest.advanceTimersByTime(6000)
      })
    }
    // Flush pending microtasks
    await act(async () => {
      await Promise.resolve()
    })
  }
  // Flush finish call
  await act(async () => {
    await Promise.resolve()
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSyncPlayers', () => {
  it('returns initial idle state', () => {
    const { result } = renderHook(() => useSyncPlayers())
    expect(result.current.state).toBe('idle')
    expect(result.current.progress).toEqual({ current: 0, total: 0, playersUpserted: 0 })
    expect(result.current.error).toBeNull()
  })

  it('completes successfully: state=completed, total=teamIds.length, playersUpserted>0', async () => {
    const { result } = renderHook(() => useSyncPlayers())

    // Kick off start()
    act(() => {
      void result.current.start()
    })

    // Let start fetch resolve
    await act(async () => {
      await Promise.resolve()
    })

    await driveLoop(TEAM_IDS.length)

    await waitFor(
      () => {
        expect(result.current.state).toBe('completed')
      },
      { timeout: 2000 },
    )

    expect(result.current.progress.total).toBe(TEAM_IDS.length)
    expect(result.current.progress.playersUpserted).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('sets state=failed and error=SYNC_IN_PROGRESS when /sync/start returns non-success', async () => {
    global.fetch = jest.fn().mockImplementation(async (input: string) => {
      if (input === '/api/admin/players/sync/start') {
        return jsonOk({ success: false, error: 'SYNC_IN_PROGRESS' })
      }
      return jsonOk({ success: false, error: 'UNKNOWN_ERROR' })
    })

    const { result } = renderHook(() => useSyncPlayers())

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('failed')
    expect(result.current.error).toBe('SYNC_IN_PROGRESS')

    // No further fetches beyond the start call
    const fetchCalls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit?][]
    expect(fetchCalls.every(([url]) => url === '/api/admin/players/sync/start')).toBe(true)
  })

  it('sets state=failed and error=NETWORK_ERROR when /sync/start throws', async () => {
    global.fetch = jest.fn().mockImplementation(async (input: string) => {
      if (input === '/api/admin/players/sync/start') {
        throw new Error('Network failure')
      }
      return jsonOk({ success: false, error: 'UNKNOWN_ERROR' })
    })

    const { result } = renderHook(() => useSyncPlayers())

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state).toBe('failed')
    expect(result.current.error).toBe('NETWORK_ERROR')
  })

  it('recovers from per-team team-detail error: loop continues, final state=completed', async () => {
    let teamDetailCount = 0

    global.fetch = jest.fn().mockImplementation(async (input: string) => {
      if (input === '/api/admin/players/sync/start') {
        return jsonOk({ success: true, syncRunId: SYNC_RUN_ID, teamIds: TEAM_IDS })
      }
      if (typeof input === 'string' && input.startsWith('/api/admin/players/team-detail')) {
        teamDetailCount++
        // First team fails, subsequent succeed
        if (teamDetailCount === 1) {
          return jsonOk({ success: false, error: 'FETCH_FAILED' })
        }
        return jsonOk({ success: true, squad: defaultSquad })
      }
      if (input === '/api/admin/players/save-team') {
        return jsonOk({ success: true, playersUpserted: 2 })
      }
      if (input === '/api/admin/players/sync/finish') {
        return jsonOk({ success: true })
      }
      if (input === '/api/admin/players/sync/item-error') {
        return jsonOk({ success: true })
      }
      return jsonOk({ success: false, error: 'UNKNOWN_ERROR' })
    })

    const { result } = renderHook(() => useSyncPlayers())

    act(() => {
      void result.current.start()
    })

    // Let start fetch resolve
    await act(async () => {
      await Promise.resolve()
    })

    await driveLoop(TEAM_IDS.length)

    await waitFor(
      () => {
        expect(result.current.state).toBe('completed')
      },
      { timeout: 2000 },
    )

    // All 3 teams were processed (current reached 3)
    expect(result.current.progress.current).toBe(TEAM_IDS.length)
  })

  it('is a no-op if start() is called while already running', async () => {
    const { result } = renderHook(() => useSyncPlayers())

    // Start without awaiting
    act(() => {
      void result.current.start()
    })

    // Let the start fetch resolve so the hook is truly running
    await act(async () => {
      await Promise.resolve()
    })

    // Call start() again while running — should be a no-op
    await act(async () => {
      await result.current.start()
    })

    // Only one /sync/start call should have been made
    const fetchCalls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit?][]
    const startCalls = fetchCalls.filter(([url]) => url === '/api/admin/players/sync/start')
    expect(startCalls).toHaveLength(1)

    // Clean up: drain the loop so afterEach doesn't bleed timers
    await act(async () => {
      jest.advanceTimersByTime(6000 * (TEAM_IDS.length - 1) + 100)
    })
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('increments progress.current from 0 to teamIds.length', async () => {
    const { result } = renderHook(() => useSyncPlayers())
    const progressSnapshots: number[] = []

    act(() => {
      void result.current.start()
    })

    // Let start fetch resolve
    await act(async () => {
      await Promise.resolve()
    })

    // Capture progress after each team is processed
    for (let i = 0; i < TEAM_IDS.length; i++) {
      if (i > 0) {
        await act(async () => {
          jest.advanceTimersByTime(6000)
        })
      }
      await act(async () => {
        await Promise.resolve()
      })
      progressSnapshots.push(result.current.progress.current)
    }

    // Flush finish
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(
      () => {
        expect(result.current.state).toBe('completed')
      },
      { timeout: 2000 },
    )

    // Progress should have moved monotonically upward, ending at teamIds.length
    expect(result.current.progress.current).toBe(TEAM_IDS.length)
    for (let i = 1; i < progressSnapshots.length; i++) {
      expect(progressSnapshots[i]).toBeGreaterThanOrEqual(progressSnapshots[i - 1])
    }
  })
})
