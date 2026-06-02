---
name: project-players-sync-patterns
description: Recurring patterns and gap types from World Cup Player Sync validation (client-orchestrated sync, 5-route architecture)
metadata:
  type: project
---

Recurring patterns found during World Cup Player Sync feature validation.

**Why:** Documenting for future validation runs on similar client-orchestrated sync features.

**How to apply:** Check these specific patterns whenever validating sync or multi-step orchestration features.

## Architecture pattern used
Five thin server routes each doing one unit of work; browser drives the throttle loop. No PlayersService layer — routes call PlayersRepository directly. This is an intentional brief-approved deviation from the standard hexagonal pattern (which requires a service between routes and repositories).

## Gap types found

### `getActiveSync` silently swallows DB errors
`PlayersRepository.getActiveSync()` (L226) destructures only `{ data }` from Supabase, not `{ data, error }`. A DB error at this step returns `null` (treating it as "no active sync") instead of throwing, which allows a new sync to start even when the DB is failing. No test covers this error path.

### Missing player-role 403 tests in 3 of 5 route tests
`sync-start` and `sync-item-error` test the player-role 403 scenario. `team-detail`, `save-team`, and `sync-finish` do not. This is a recurring pattern: only the first route written tends to get the full role-check coverage.

### Orphan `in_progress` sync_run on `getDistinctTeamExternalIds` failure
If `createSyncRun()` succeeds but `getDistinctTeamExternalIds()` then throws (both inside the same try block in `sync/start/route.ts`), the sync_run is left in `in_progress` state and will block new syncs for 30 minutes. The 30-min stale guard is the only recovery mechanism.

### `useSyncPlayers` hook tests cover team-detail per-team failure but NOT save-team per-team failure
The hook implements error recovery for both `team-detail` and `save-team` errors, but only one dedicated per-team recovery test exists (for `team-detail`). The `save-team` failure-recovery path is only implicitly covered by the happy-path test infrastructure.

### Hook does not test per-team network-level failure (throw inside loop)
The hook has separate catch blocks for network errors when fetching `team-detail` or `save-team` inside the team loop. These throw-paths in the loop body are not tested — only the `/sync/start` network throw is tested.

## What was confirmed correct
- Migration: all 3 tables, partial unique index, UNION-based `get_distinct_team_external_ids` RPC — all correct.
- `getActiveSync` correctly uses `gte(started_at, 30min-ago)` for stale guard.
- `upsertPlayers` correctly uses `onConflict: 'provider_player_id', ignoreDuplicates: false`.
- API key never in response (team-detail route tested).
- `useRef` guard prevents double-invocation.
- 6-second delay only between teams (not before first).
- All 5 i18n error keys present in both en.json and es.json.
- No `teams` table created anywhere.
- `PlayerDbRow` camelCase keys match save-team route validator.
