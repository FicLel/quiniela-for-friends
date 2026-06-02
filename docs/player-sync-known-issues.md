# Player Sync — Known Issues

Findings from the implementation-validator run on 2026-06-02.
All critical acceptance criteria passed. The items below were deferred for a follow-up.

---

## IMPORTANT

### I1 — `getActiveSync` silently swallows Supabase errors

**File:** `players/PlayersRepository.ts` — `getActiveSync()` method

**Problem:** The method destructures only `{ data }` from the Supabase chain, discarding the
`error` field. If the DB call fails (connection error, permission denied, etc.), the method
returns `null` (no active sync) instead of throwing. The `/sync/start` route then proceeds
to create a new `sync_run` during a degraded DB state.

Every other repository method correctly destructures `{ data, error }` and throws on error.

**Fix:** Destructure `{ data, error }` and throw if `error` is set, matching the pattern used
by all other methods in the same file.

---

### I3 — Three route tests missing the "valid session, wrong role" 403 scenario

**Files:**
- `app/api/admin/players/__tests__/team-detail.test.ts`
- `app/api/admin/players/__tests__/save-team.test.ts`
- `app/api/admin/players/__tests__/sync-finish.test.ts`

**Problem:** These three test files only test unauthenticated (null token) → 403. They do not
verify that a valid but non-admin session (role: `'player'`) is also rejected. The other two
route tests (`sync-start` and `sync-item-error`) already have this case covered.

**Fix:** Add one `makePlayerRequest()` + 403 assertion test case to each of the three files,
following the pattern already present in `sync-start.test.ts`.

---

### I4 — Hook test missing `save-team` failure recovery path

**File:** `app/[lang]/(private)/welcome/__tests__/useSyncPlayers.test.ts`

**Problem:** The hook has three distinct per-team error recovery paths:
1. Non-2xx from `team-detail` — **covered**
2. Network throw from `team-detail` — **covered**
3. Non-2xx or network throw from `save-team` after a successful `team-detail` — **not covered**

The loop should continue when `save-team` fails. This path is currently untested.

**Fix:** Add one test case where `team-detail` returns success but `save-team` returns
`{ success: false }`. Verify the loop continues, `item-error` is posted, `progress.current`
still increments, and the final state is `'completed'`.

---

### I5 — `getActiveSync` DB error path untested in repository tests

**File:** `players/__tests__/PlayersRepository.test.ts` — `getActiveSync` describe block

**Problem:** Pairs with I1. There is no test documenting (or catching) the silent error swallow.
A test that mocks `maybeSingle()` returning `{ data: null, error: { message: '...' } }` does
not exist, so the swallow behaviour is never asserted.

**Fix:** Add one test case where `.maybeSingle()` returns `{ data: null, error: { message: 'connection refused' } }`.
Once I1 is fixed (method now throws), this test verifies the throw. Until then it documents
the current swallow behaviour.

---

## MINOR

### M2 — `get_distinct_team_external_ids` Postgres function missing `SET search_path`

**File:** `supabase/migrations/20260608000000_players_sync.sql`

**Problem:** `SECURITY DEFINER` functions should pin `search_path` to prevent search-path
hijacking. The function definition does not include `SET search_path = public, pg_temp`.
Low practical risk given service-role-only access, but it is a security hygiene gap.
The pre-existing `increment_token_version` function in `20260606000000_token_version.sql`
has the same gap.

**Fix:** Add `SET search_path = public, pg_temp` to the function definition and apply as a
new migration (not in-place edit of the existing one).

---

### M3 — No component-level test for `SyncPlayersButtonInner`

**File:** `app/[lang]/(private)/welcome/_components/__tests__/ImportMatchesButton.test.tsx`

**Problem:** The hook is tested separately via `useSyncPlayers.test.ts`, but the button
rendering, disabled state, progress text substitution (`{current}/{total}`), and error display
inside `SyncPlayersButtonInner` have no component-level coverage.

The other three sub-components (`ImportMatchesButtonInner`, `SeedPlaceholdersButtonInner`,
`SyncKnockoutButtonInner`) are also uncovered at the component level, so this is consistent
with the pre-existing gap rather than a regression.

**Fix:** Add smoke tests for `SyncPlayersButtonInner` to `ImportMatchesButton.test.tsx`,
covering: renders for admin, shows spinner while running, shows success text, shows error text
for `SYNC_IN_PROGRESS`. Mock `useSyncPlayers` via `jest.mock`.
