/**
 * GET /api/quinielas/[quinielaId]/extra-questions/teams
 *
 * Autocomplete endpoint for team names. Requires quiniela-level admin membership.
 * Filters by optional `q` query parameter (case-insensitive substring match).
 *
 * Auth: valid session + approved admin membership in the quiniela required.
 *
 * Query params:
 *   q — optional search string for filtering
 *
 * Returns:
 *   200: { success: true; teams: { name: string; externalId: number }[] }
 *   401: { success: false; error: 'UNAUTHORIZED' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'UNKNOWN_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'

type TeamsResponse =
  | { success: true; teams: { name: string; externalId: number }[] }
  | { success: false; error: string }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quinielaId: string }> },
): Promise<Response> {
  // 1. Auth check — session required
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: TeamsResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 401 })
  }

  // 2. Quiniela-level admin check
  const { quinielaId } = await params
  const membershipsRepo = new MembershipsRepository()
  const membership = await membershipsRepo.findByQuinielaAndUser(quinielaId, session.sub)

  if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
    const result: TeamsResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 3. Extract optional filter param
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase() ?? ''

  // 4. Fetch all distinct teams
  try {
    const competitionsRepo = new CompetitionsRepository()
    const teams = await competitionsRepo.findDistinctTeams()

    // 5. Filter by q if provided
    const filtered = q
      ? teams.filter((t) => t.name.toLowerCase().includes(q))
      : teams

    const result: TeamsResponse = { success: true, teams: filtered }
    return Response.json(result, { status: 200 })
  } catch {
    const result: TeamsResponse = { success: false, error: 'UNKNOWN_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
