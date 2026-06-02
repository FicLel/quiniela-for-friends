/**
 * GET /api/admin/players/team-detail?teamId={teamId}
 *
 * Admin-only endpoint. Fetches squad data for a single team from
 * football-data.org and returns the squad array. The API key is never
 * included in the response.
 *
 * Auth   : requires a valid session with role === 'admin'
 * Query  : teamId — numeric team external ID
 * Returns: TeamDetailResponse
 *
 * HTTP status codes:
 *   200 — success: { success: true, squad }
 *   400 — missing or non-numeric teamId
 *   403 — not authenticated or not admin
 *   502 — upstream fetch failed
 */

import { AuthClient } from '@/auth/AuthClient'
import type { ProviderTeamDetailResponse, TeamDetailResponse } from '@/players/players.types'

export async function GET(request: Request): Promise<Response> {
  // 1. Auth check — must be an admin session
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    const result: TeamDetailResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 2. Parse and validate teamId query parameter
  const { searchParams } = new URL(request.url)
  const teamIdRaw = searchParams.get('teamId')
  const teamId = teamIdRaw ? parseInt(teamIdRaw, 10) : NaN

  if (!teamIdRaw || isNaN(teamId) || !isFinite(teamId)) {
    const result: TeamDetailResponse = { success: false, error: 'MISSING_PARAM' }
    return Response.json(result, { status: 400 })
  }

  // 3. Fetch team detail from football-data.org
  try {
    const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY ?? ''
    const response = await fetch(
      `https://api.football-data.org/v4/teams/${teamId}`,
      { headers: { 'X-Auth-Token': apiKey } },
    )

    if (!response.ok) {
      const result: TeamDetailResponse = { success: false, error: 'FETCH_FAILED' }
      return Response.json(result, { status: 502 })
    }

    const data = (await response.json()) as ProviderTeamDetailResponse

    // 5. Return squad — never include the API key in the response
    const result: TeamDetailResponse = {
      success: true,
      squad: data.squad ?? [],
    }
    return Response.json(result, { status: 200 })
  } catch {
    const result: TeamDetailResponse = { success: false, error: 'FETCH_FAILED' }
    return Response.json(result, { status: 502 })
  }
}
