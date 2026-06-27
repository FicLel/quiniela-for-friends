/**
 * TournamentBracketCache — two-layer cache wrapper over the existing
 * TtlCache utility (see lib/ttlCache.ts), purpose-built for the tournament
 * bracket feature.
 *
 * Layer 1 (shared, quiniela-agnostic):
 *   GroupProjection[] + the cascade-resolved bracket skeleton (matchId ->
 *   resolved team names). Single global cache key, because this data does
 *   not depend on which quiniela or which member is asking — it is derived
 *   purely from `matches`. Invalidated whenever CompetitionsRepository
 *   writes to `matches` (syncRegulationResults, upsertKnockoutPlaceholders,
 *   updateKnockoutTeams) — see the `invalidateLayer1OnMatchesWrite` hook
 *   wired into CompetitionsRepository.
 *
 * Layer 2 (per quiniela+user):
 *   The merged bracket+prediction view returned to a specific member. Keyed
 *   by `${quinielaId}:${userId}` so two different quinielas, or two
 *   different users in the same quiniela, never share an entry (see the
 *   cross-tenant regression test in __tests__/TournamentBracketCache.test.ts).
 *   Cleared in full on any result sync (cascade resolution can change for
 *   every member at once), and invalidated by single key when that specific
 *   user writes/updates a prediction.
 *
 * Both layers share the existing TtlCache's 30s TTL / LRU semantics — no new
 * cache mechanism is introduced.
 */

import { TtlCache } from '@/lib/ttlCache'
import type { GroupProjection, BracketView } from '@/tournaments/tournaments.types'

const LAYER1_TTL_MS = 30_000
const LAYER1_CACHE_KEY = 'global'

const LAYER2_TTL_MS = 30_000
const LAYER2_MAX_ENTRIES = 500

export type Layer1Skeleton = {
  projections: GroupProjection[]
  /** matchId -> resolved team names (cascade-resolved, display-only). */
  resolvedTeamsByMatchId: Map<string, { homeTeamName: string; awayTeamName: string }>
}

const layer1Cache = new TtlCache<Layer1Skeleton>(LAYER1_TTL_MS, 1)
const layer2Cache = new TtlCache<BracketView>(LAYER2_TTL_MS, LAYER2_MAX_ENTRIES)

function layer2Key(quinielaId: string, userId: string): string {
  return `${quinielaId}:${userId}`
}

export class TournamentBracketCache {
  // -- Layer 1 -------------------------------------------------------------

  getLayer1(): Layer1Skeleton | undefined {
    return layer1Cache.get(LAYER1_CACHE_KEY)
  }

  setLayer1(skeleton: Layer1Skeleton): void {
    layer1Cache.set(LAYER1_CACHE_KEY, skeleton)
  }

  /** Invalidate Layer 1 — call from any matches-table write path. */
  invalidateLayer1(): void {
    layer1Cache.invalidate(LAYER1_CACHE_KEY)
  }

  // -- Layer 2 -------------------------------------------------------------

  getLayer2(quinielaId: string, userId: string): BracketView | undefined {
    return layer2Cache.get(layer2Key(quinielaId, userId))
  }

  setLayer2(quinielaId: string, userId: string, view: BracketView): void {
    layer2Cache.set(layer2Key(quinielaId, userId), view)
  }

  /** Invalidate a single member's bracket view — call after they write a prediction. */
  invalidateLayer2(quinielaId: string, userId: string): void {
    layer2Cache.invalidate(layer2Key(quinielaId, userId))
  }

  /** Clear every Layer 2 entry — call on any result sync (affects all members). */
  clearLayer2(): void {
    layer2Cache.clear()
  }
}

// Module-level singleton, mirroring the pattern used by matchesCache /
// playerPredictionsCache in competitions/CompetitionsRepository.ts and
// scoring/PredictionScoreRepository.ts — process-scoped, shared across all
// instances of TournamentBracketService within this server process.
export const tournamentBracketCache = new TournamentBracketCache()

/** Reset both cache layers — intended for tests only. */
export function resetTournamentBracketCache(): void {
  layer1Cache.clear()
  layer2Cache.clear()
}
