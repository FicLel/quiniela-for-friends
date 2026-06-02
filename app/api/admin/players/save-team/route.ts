/**
 * POST /api/admin/players/save-team
 *
 * Admin-only endpoint. Upserts players for one team and records a
 * sync_run_items success entry.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Body   : SaveTeamBody — { syncRunId, teamExternalId, players }
 * Returns: SaveTeamResponse
 *
 * HTTP status codes:
 *   200 — success: { success: true, playersUpserted }
 *   400 — invalid payload
 *   403 — not authenticated or not admin
 *   500 — DB_ERROR
 */

import { AuthClient } from '@/auth/AuthClient'
import { PlayersRepository } from '@/players/PlayersRepository'
import type { PlayerDbRow, SaveTeamBody, SaveTeamResponse } from '@/players/players.types'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

function isPlayerDbRow(v: unknown): v is PlayerDbRow {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  if (!isInteger(p.providerPlayerId)) return false
  if (!isInteger(p.teamExternalId)) return false
  if (typeof p.name !== 'string') return false
  if (p.position !== null && typeof p.position !== 'string') return false
  if (p.shirtNumber !== null && !isInteger(p.shirtNumber)) return false
  return true
}

function validateBody(body: unknown): SaveTeamBody | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (!isString(b.syncRunId)) return null
  if (!isInteger(b.teamExternalId)) return null
  if (!Array.isArray(b.players)) return null
  for (const item of b.players) {
    if (!isPlayerDbRow(item)) return null
  }
  return {
    syncRunId: b.syncRunId as string,
    teamExternalId: b.teamExternalId as number,
    players: b.players as PlayerDbRow[],
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
    const result: SaveTeamResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: SaveTeamResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  const payload = validateBody(body)
  if (payload === null) {
    const result: SaveTeamResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  // 3. Upsert players and record success item
  try {
    const repo = new PlayersRepository()

    const count = await repo.upsertPlayers(payload.players)

    await repo.createSyncRunItem({
      syncRunId: payload.syncRunId,
      teamExternalId: payload.teamExternalId,
      status: 'success',
      playersUpserted: count,
    })

    const result: SaveTeamResponse = { success: true, playersUpserted: count }
    return Response.json(result, { status: 200 })
  } catch {
    const result: SaveTeamResponse = { success: false, error: 'DB_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
