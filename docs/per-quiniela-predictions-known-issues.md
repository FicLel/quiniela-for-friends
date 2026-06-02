# Per-Quiniela Predictions — Known Issues

Findings from the implementation-validator run on 2026-06-02.
All critical acceptance criteria passed. The items below were deferred for a follow-up.

---

## IMPORTANT

### I1 — `upsertBatch` in `PredictionScoreRepository` has no repository-level tests

**File:** `scoring/PredictionScoreRepository.ts` — `upsertBatch()` method

**Problem:** The method does a `supabase.upsert()` on `prediction_scores` with
`onConflict: 'prediction_id,quiniela_id'`. No test verifies the payload shape,
the `ignoreDuplicates: false` flag, or the error path.

**Fix:** Add `upsertBatch` tests to `scoring/__tests__/PredictionScoreRepository.test.ts`
covering: correct rows passed, conflict target used, error surfaced as thrown.

---

### I2 — `aggregateByQuiniela` in `PredictionScoreRepository` has no repository-level tests

**File:** `scoring/PredictionScoreRepository.ts` — `aggregateByQuiniela()` method

**Problem:** The method joins `prediction_scores` with `user_expected_results!inner(user_id)`
and does in-memory aggregation. No test verifies the join call, the aggregation logic, or the
error path. This is one of the most business-critical paths for the leaderboard (AC-8, AC-9).

**Fix:** Add `aggregateByQuiniela` tests to `scoring/__tests__/PredictionScoreRepository.test.ts`
covering: correct quiniela filter applied, points summed per user, empty result, error surfaced.

---

### I3 — EC-4 UUID tiebreak coded but not asserted in any test

**File:** `appSettings/AppSettingsRepository.ts` — `findOldestQuinielaId()` method (~L141)

**Problem:** The secondary `.order('quinielas(id)', { ascending: true })` call is present in
code but no test asserts it was called. A regression that silently drops the secondary sort
would pass all existing tests.

**Fix:** In `appSettings/__tests__/AppSettingsRepository.test.ts`, add an assertion on the
second `mockMembershipsOrder` call verifying it received `'quinielas(id)'` and
`{ ascending: true }`.

---

### I4 — `QuinielasRepository.findAllForUser` `approved_at` filter has no repository-level test

**File:** `quinielas/QuinielasRepository.ts` — `findAllForUser()` method (~L90–L102)

**Problem:** The filter `.not('quiniela_memberships.approved_at', 'is', null)` was added to
prevent unapproved quinielas appearing in the switcher (AC-4, EC-7), but `quinielas/__tests__/`
only contains `QuinielasService.test.ts` with a mocked repository. The filter is never exercised
below the service mock.

**Fix:** Create `quinielas/__tests__/QuinielasRepository.test.ts` with at least:
- approved membership → quiniela is returned
- pending membership (`approved_at IS NULL`) → quiniela is excluded
- no membership → empty result

---

## MINOR

### M1 — Stale comment in `AppSettingsRepository.test.ts`

**File:** `appSettings/__tests__/AppSettingsRepository.test.ts` — line 17

**Problem:** The comment describes the old `select('id', {count:'exact'})` chain that no longer
matches the actual implementation (which uses `.update().gt()` then `.select('id').limit(1).maybySingle()`).

**Fix:** Update or remove the comment.

---

### M2 — TOCTOU race window in `ExpectedResultsRepository.upsert`

**File:** `expectedResults/ExpectedResultsRepository.ts` — `upsert()` method (~L86–L123)

**Problem:** The SELECT→INSERT pattern has a narrow race window: two concurrent first-saves for
the same `(user_id, match_id, quiniela_id)` both pass the pre-check, then the second INSERT
fails on the DB unique constraint and surfaces as `UNKNOWN_ERROR` to the caller. The DB
constraints prevent data corruption, but the second concurrent caller gets an error response
instead of a silent idempotent success.

**Fix:** Catch DB unique-constraint violations on the INSERT path and treat them as a conflict
(retry as UPDATE, or return the existing row). Alternatively, document this as an accepted
tradeoff given the low likelihood of exact-same-user concurrent saves.
