---
name: ttlcache-usage
description: Current scope of TtlCache (lib/ttlCache.ts) usage as of 2026-06-12 — only 2 singleton instances exist, none in scoring module
metadata:
  type: project
---

`lib/ttlCache.ts` exports a generic `TtlCache<V>` (TTL + LRU eviction via `maxEntries`).

As of 2026-06-12, only two instances exist, both singleton (`maxEntries: 1`, one global key):
- `competitions/CompetitionsRepository.ts`: `matchesCache = new TtlCache<Match[]>(30_000, 1)` — all matches, global.
- `appSettings/AppSettingsRepository.ts`: `settingsCache = new TtlCache<AppSettings | null>(60_000, 1)` — app settings, global.

**Important**: `scoring/LeaderboardService.ts` and `scoring/PredictionScoreRepository.ts` do NOT use TtlCache at all (verified by reading both files in full). The commit message "Added LRU, improved performance for query databases" (73ece06's predecessor, 8d64e3e-ish) refers to `lib/ttlCache.ts` + `lib/schemaCheckCache.ts` (process-scoped schema-check memoization via `verifyTableOnce`), not a per-user prediction cache.

**How to apply:** When a future feature needs to cache per-user or per-(quiniela,user) data, do NOT try to "extend" `matchesCache` or `settingsCache` — their `maxEntries: 1` shape is wrong for keyed data. Create a new dedicated `TtlCache` instance with `maxEntries` sized for the expected key cardinality, keyed by a composite string like `${quinielaId}:${userId}`.

[[arch-patterns]]
