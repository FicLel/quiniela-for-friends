/**
 * POST /api/admin/players/sync/start
 *
 * Admin-only endpoint. Checks for an active sync run and, if none exists,
 * creates a new sync_run and returns the list of team IDs to process.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Returns: SyncStartResponse
 *
 * HTTP status codes:
 *   200 — success: { success: true, syncRunId, teamIds }
 *   403 — not authenticated or not admin
 *   409 — a sync is already in_progress (within the last 30 minutes)
 *   500 — DB_ERROR
 */

import { AuthClient } from '@/auth/AuthClient'
import { PlayersRepository } from '@/players/PlayersRepository'
import type { SyncStartResponse } from '@/players/players.types'

export async function POST(): Promise<Response> {
  // 1. Auth check — must be an admin session
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    const result: SyncStartResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: SyncStartResponse = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  const repo = new PlayersRepository()
  let syncRunId: string | undefined

  try {
    // 2. Check for an active (non-stale) sync run
    const activeSync = await repo.getActiveSync()
    if (activeSync) {
      const result: SyncStartResponse = { success: false, error: 'SYNC_IN_PROGRESS' }
      return Response.json(result, { status: 409 })
    }

    // 3. Create a new sync run
    const syncRun = await repo.createSyncRun()
    syncRunId = syncRun.id

    // 4. Get the list of team IDs from matches
    const teamIds = await repo.getDistinctTeamExternalIds()

    // 5. Return
    const result: SyncStartResponse = {
      success: true,
      syncRunId: syncRun.id,
      teamIds,
    }
    return Response.json(result, { status: 200 })
  } catch {
    // If a sync_run was already created, mark it failed so the unique index is released
    // and the next sync attempt is not blocked for 30 minutes.
    if (syncRunId) {
      try { await repo.updateSyncRun(syncRunId, 'failed', new Date()) } catch { /* best-effort */ }
    }
    const result: SyncStartResponse = { success: false, error: 'DB_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
