/**
 * POST /api/admin/players/sync/item-error
 *
 * Admin-only endpoint. Records a failed sync_run_items entry when a team
 * could not be processed.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Body   : SyncItemErrorBody — { syncRunId, teamExternalId, errorMessage }
 * Returns: SyncItemErrorResponse
 *
 * HTTP status codes:
 *   200 — success: { success: true }
 *   400 — invalid payload
 *   403 — not authenticated or not admin
 *   500 — DB_ERROR
 */

import { AuthClient } from '@/auth/AuthClient'
import { PlayersRepository } from '@/players/PlayersRepository'
import type { SyncItemErrorBody, SyncItemErrorResponse } from '@/players/players.types'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateBody(body: unknown): SyncItemErrorBody | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.syncRunId !== 'string' || b.syncRunId.length === 0) return null
  if (typeof b.teamExternalId !== 'number' || !Number.isInteger(b.teamExternalId)) return null
  if (typeof b.errorMessage !== 'string' || b.errorMessage.length === 0) return null
  return {
    syncRunId: b.syncRunId as string,
    teamExternalId: b.teamExternalId as number,
    errorMessage: b.errorMessage as string,
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
    const result: SyncItemErrorResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: SyncItemErrorResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  const payload = validateBody(body)
  if (payload === null) {
    const result: SyncItemErrorResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  // 3. Record the error item
  try {
    const repo = new PlayersRepository()
    await repo.createSyncRunItem({
      syncRunId: payload.syncRunId,
      teamExternalId: payload.teamExternalId,
      status: 'error',
      errorMessage: payload.errorMessage,
    })

    const result: SyncItemErrorResponse = { success: true }
    return Response.json(result, { status: 200 })
  } catch {
    const result: SyncItemErrorResponse = { success: false, error: 'DB_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
