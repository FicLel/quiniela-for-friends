/**
 * GET /api/quinielas/[quinielaId]/extra-questions/players
 *
 * Autocomplete endpoint for player names. Requires quiniela-level admin membership.
 * Fetches all teams from the matches table, then all players for those teams,
 * and filters by optional `q` query parameter (case-insensitive substring match).
 *
 * Auth: valid session + approved admin membership in the quiniela required.
 *
 * Query params:
 *   q — optional search string for filtering
 *
 * Returns:
 *   200: { success: true; players: { id: string; name: string; teamName: string; position: string | null }[] }
 *   401: { success: false; error: 'UNAUTHORIZED' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'UNKNOWN_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { PlayersRepository } from '@/players/PlayersRepository'

type PlayerItem = {
  id: string
  name: string
  teamName: string
  position: string | null
}

type PlayersResponse =
  | { success: true; players: PlayerItem[] }
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
    const result: PlayersResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 401 })
  }

  // 2. Quiniela-level admin check
  const { quinielaId } = await params
  const membershipsRepo = new MembershipsRepository()
  const membership = await membershipsRepo.findByQuinielaAndUser(quinielaId, session.sub)

  if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
    const result: PlayersResponse = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  // 3. Extract optional filter param
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase() ?? ''

  try {
    // 4. Get all distinct teams (includes externalId)
    const competitionsRepo = new CompetitionsRepository()
    const teams = await competitionsRepo.findDistinctTeams()
    const teamExternalIds = teams.map((t) => t.externalId)

    // Build a lookup map for team name by externalId
    const teamNameById = new Map<number, string>(
      teams.map((t) => [t.externalId, t.name]),
    )

    // 5. Fetch players for those teams
    const playersRepo = new PlayersRepository()
    const players = await playersRepo.findByTeamExternalIds(teamExternalIds)

    // 6. Map to response shape and apply filter
    const allPlayers: PlayerItem[] = players.map((p) => ({
      id: p.id,
      name: p.name,
      teamName: teamNameById.get(p.teamExternalId) ?? '',
      position: p.position,
    }))

    const filtered = q
      ? allPlayers.filter((p) => p.name.toLowerCase().includes(q))
      : allPlayers

    const result: PlayersResponse = { success: true, players: filtered }
    return Response.json(result, { status: 200 })
  } catch {
    const result: PlayersResponse = { success: false, error: 'UNKNOWN_ERROR' }
    return Response.json(result, { status: 500 })
  }
}
