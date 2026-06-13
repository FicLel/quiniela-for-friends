/**
 * POST /api/admin/matches/sync
 *
 * Admin-only endpoint. Accepts a batch of regulation-time results for matches,
 * updates the matches table, and recalculates prediction scores.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Body   : { matches: { matchId: string; regulationHomeGoals: number; regulationAwayGoals: number }[] }
 * Returns: SyncRegulationResultsResult
 *
 * HTTP status codes:
 *   200 — success
 *   400 — invalid payload
 *   403 — not authenticated or not admin
 *   500 — DB_ERROR
 */

import { AuthClient } from '@/auth/AuthClient'
import { CompetitionsService } from '@/competitions/CompetitionsService'
import { CompetitionsClient } from '@/competitions/CompetitionsClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { ScoringService } from '@/scoring/ScoringService'
import { PredictionScoreRepository } from '@/scoring/PredictionScoreRepository'
import type { SyncRegulationResultsResult, SyncResultPayload } from '@/competitions/competitions.types'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function validatePayload(body: unknown): SyncResultPayload[] | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.matches)) return null

  const matches: SyncResultPayload[] = []
  for (const item of b.matches) {
    if (typeof item !== 'object' || item === null) return null
    const m = item as Record<string, unknown>
    if (!isUUID(m.matchId)) return null
    if (!isNonNegativeInteger(m.regulationHomeGoals)) return null
    if (!isNonNegativeInteger(m.regulationAwayGoals)) return null
    matches.push({
      matchId: m.matchId as string,
      regulationHomeGoals: m.regulationHomeGoals as number,
      regulationAwayGoals: m.regulationAwayGoals as number,
    })
  }

  return matches
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
    const result: SyncRegulationResultsResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: SyncRegulationResultsResult = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: SyncRegulationResultsResult = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  const payload = validatePayload(body)
  if (payload === null) {
    const result: SyncRegulationResultsResult = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  // 3. Execute
  const competitionsRepo = new CompetitionsRepository()
  const scoringService = new ScoringService(new PredictionScoreRepository(), competitionsRepo)
  const service = new CompetitionsService(new CompetitionsClient(), competitionsRepo, scoringService)

  const result = await service.syncRegulationResults(payload)

  if (!result.success) {
    return Response.json(result, { status: 500 })
  }

  return Response.json(result, { status: 200 })
}
