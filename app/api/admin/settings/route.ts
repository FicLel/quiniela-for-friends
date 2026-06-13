/**
 * GET  /api/admin/settings
 * PUT  /api/admin/settings
 *
 * Admin-only endpoint for reading and updating application-wide settings.
 * Currently exposes only `predictionMode` ('shared' | 'per_quiniela').
 *
 * Auth   : requires a valid session with role === 'admin'
 *
 * GET returns:
 *   200: { success: true; settings: { predictionMode: 'shared' | 'per_quiniela' } }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'NOT_FOUND' | 'UNKNOWN_ERROR' }
 *
 * PUT body: { predictionMode: 'shared' | 'per_quiniela' }
 * PUT returns:
 *   200: { success: true }
 *   400: { success: false; error: 'INVALID_PAYLOAD' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'INVALID_MODE' | 'DB_ERROR' | 'UNKNOWN_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { AppSettingsService } from '@/appSettings/AppSettingsService'
import { AppSettingsRepository } from '@/appSettings/AppSettingsRepository'
import type { PredictionMode } from '@/appSettings/appSettings.types'

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

type GetSettingsResponse =
  | { success: true; settings: { predictionMode: PredictionMode } }
  | { success: false; error: string }

type PutSettingsResponse =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidPredictionMode(value: unknown): value is PredictionMode {
  return value === 'shared' || value === 'per_quiniela'
}

// ---------------------------------------------------------------------------
// GET /api/admin/settings
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  // 1. Auth check — must be an admin session
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    const result: GetSettingsResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Fetch settings
  const service = new AppSettingsService(new AppSettingsRepository())
  const result = await service.getSettings()

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 500 })
  }

  const response: GetSettingsResponse = {
    success: true,
    settings: { predictionMode: result.settings.predictionMode },
  }
  return Response.json(response, { status: 200 })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/settings
// ---------------------------------------------------------------------------

export async function PUT(request: Request): Promise<Response> {
  // 1. Auth check — must be an admin session
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    const result: PutSettingsResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: PutSettingsResponse = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: PutSettingsResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    const result: PutSettingsResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  const { predictionMode } = body as Record<string, unknown>
  if (!isValidPredictionMode(predictionMode)) {
    const result: PutSettingsResponse = { success: false, error: 'INVALID_PAYLOAD' }
    return Response.json(result, { status: 400 })
  }

  // 3. Execute
  const service = new AppSettingsService(new AppSettingsRepository())
  const result = await service.setPredictionMode(predictionMode)

  if (!result.success) {
    const statusCode = result.error === 'INVALID_MODE' ? 400 : 500
    return Response.json({ success: false, error: result.error }, { status: statusCode })
  }

  return Response.json({ success: true }, { status: 200 })
}
