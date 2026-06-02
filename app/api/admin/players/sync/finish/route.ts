/**
 * POST /api/admin/players/sync/finish
 *
 * Admin-only endpoint. Marks a sync_run as completed or failed.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Body   : SyncFinishBody — { syncRunId, status: 'completed' | 'failed' }
 * Returns: SyncFinishResponse
 *
 * HTTP status codes:
 *   200 — success: { success: true }
 *   400 — invalid payload
 *   403 — not authenticated or not admin
 *   500 — DB_ERROR
 */

import { AuthClient } from '@/auth/AuthClient'
import { PlayersRepository } from '@/players/PlayersRepository'
import type { SyncFinishBody, SyncFinishResponse } from '@/players/players.types'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateBody(body: unknown): SyncFinishBody | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.syncRunId !== 'string' || b.syncRunId.length === 0) return null
  if (b.status !== 'completed' && b.status !== 'failed') return null
  return {
    syncRunId: b.syncRunId as string,
    status: b.status as 'completed' | 'failed',
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // 1. Auth check — must be an admin session
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    const result: SyncFinishResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: SyncFinishResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  const payload = validateBody(body)
  if (payload === null) {
    const result: SyncFinishResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  // 3. Update the sync run
  try {
    const repo = new PlayersRepository()
    await repo.updateSyncRun(payload.syncRunId, payload.status, new Date())

    const result: SyncFinishResponse = { success: true }
    return Response.json(result, { status: 200 })
  } catch {
    const result: SyncFinishResponse = { success: false, error: 'DB_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
