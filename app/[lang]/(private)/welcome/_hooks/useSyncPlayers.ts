import { useState, useRef, useCallback } from 'react'
import type {
  SyncStartResponse,
  TeamDetailResponse,
  SaveTeamResponse,
  PlayerDbRow,
  ProviderSquadMember,
} from '@/players/players.types'

export type SyncState = 'idle' | 'running' | 'completed' | 'failed'

export type SyncProgress = {
  current: number
  total: number
  playersUpserted: number
}

export type UseSyncPlayersReturn = {
  state: SyncState
  progress: SyncProgress
  error: string | null
  start: () => Promise<void>
}

const INITIAL_PROGRESS: SyncProgress = { current: 0, total: 0, playersUpserted: 0 }

export function useSyncPlayers(): UseSyncPlayersReturn {
  const [state, setState] = useState<SyncState>('idle')
  const [progress, setProgress] = useState<SyncProgress>(INITIAL_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  const isRunningRef = useRef(false)

  const start = useCallback(async () => {
    // Guard: prevent double-invocation
    if (isRunningRef.current) return
    isRunningRef.current = true

    setState('running')
    setProgress(INITIAL_PROGRESS)
    setError(null)

    // Step 1: Start the sync run
    let syncRunId: string
    let teamIds: number[]

    try {
      const startRes = await fetch('/api/admin/players/sync/start', { method: 'POST' })
      const startData: SyncStartResponse = await startRes.json()

      if (!startData.success) {
        setState('failed')
        setError(startData.error)
        isRunningRef.current = false
        return
      }

      syncRunId = startData.syncRunId
      teamIds = startData.teamIds
    } catch {
      setState('failed')
      setError('NETWORK_ERROR')
      isRunningRef.current = false
      return
    }

    // Step 2: Set total in progress
    setProgress({ current: 0, total: teamIds.length, playersUpserted: 0 })

    // Step 3: Process each team
    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i]

      // Throttle: wait 6 seconds between teams (except first)
      if (i > 0) {
        await new Promise<void>((r) => setTimeout(r, 6000))
      }

      // Fetch team detail
      let squad: ProviderSquadMember[] | null = null

      try {
        const detailRes = await fetch(
          `/api/admin/players/team-detail?teamId=${teamId}`,
        )
        const detailData: TeamDetailResponse = await detailRes.json()

        if (!detailData.success) {
          // Report item error, continue
          try {
            await fetch('/api/admin/players/sync/item-error', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                syncRunId,
                teamExternalId: teamId,
                errorMessage: detailData.error,
              }),
            })
          } catch {
            // Silently ignore item-error reporting failures
          }
          setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
          continue
        }

        squad = detailData.squad
      } catch {
        // Network error fetching team detail
        try {
          await fetch('/api/admin/players/sync/item-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syncRunId,
              teamExternalId: teamId,
              errorMessage: 'NETWORK_ERROR',
            }),
          })
        } catch {
          // Silently ignore item-error reporting failures
        }
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }

      // Build player rows (squad is guaranteed non-null here; nulls always hit continue above)
      const players: PlayerDbRow[] = (squad ?? []).map((m: ProviderSquadMember) => ({
        providerPlayerId: m.id,
        teamExternalId: teamId,
        name: m.name,
        position: m.position ?? null,
        shirtNumber: m.shirtNumber ?? null,
      }))

      // Save team players
      try {
        const saveRes = await fetch('/api/admin/players/save-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncRunId, teamExternalId: teamId, players }),
        })
        const saveData: SaveTeamResponse = await saveRes.json()

        if (!saveData.success) {
          // Report item error, continue
          try {
            await fetch('/api/admin/players/sync/item-error', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                syncRunId,
                teamExternalId: teamId,
                errorMessage: saveData.error,
              }),
            })
          } catch {
            // Silently ignore item-error reporting failures
          }
          setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
          continue
        }

        // Success: accumulate players and increment
        setProgress((prev) => ({
          current: prev.current + 1,
          total: prev.total,
          playersUpserted: prev.playersUpserted + saveData.playersUpserted,
        }))
      } catch {
        // Network error saving team
        try {
          await fetch('/api/admin/players/sync/item-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syncRunId,
              teamExternalId: teamId,
              errorMessage: 'NETWORK_ERROR',
            }),
          })
        } catch {
          // Silently ignore item-error reporting failures
        }
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }
    }

    // Step 4: Finish sync
    try {
      await fetch('/api/admin/players/sync/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncRunId, status: 'completed' }),
      })
    } catch {
      // Silently ignore finish errors — the loop completed
    }

    // Step 5: Mark as completed
    setState('completed')
    isRunningRef.current = false
  }, [])

  return { state, progress, error, start }
}
