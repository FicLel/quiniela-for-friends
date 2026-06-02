---
name: project-per-quiniela-predictions-patterns
description: Recurring patterns and gap types from per-quiniela predictions validation (mode toggle, migration, switcher, scoring fan-out)
metadata:
  type: project
---

Patterns observed in the per-quiniela predictions feature (validated 2026-06-02; re-validated 2026-06-02 after backend fix pass):

**Critical: Invalid PostgREST join path in PredictionScoreRepository**
`findPredictionsWithQuinielas` uses `quiniela_memberships!inner(...)` from `user_expected_results` but there is no FK between these two tables (they share only `user_id` and `quiniela_id` fields). PostgREST requires a valid FK to resolve `!inner` joins. No FK was added in the migration.

**Critical: Broken upsert conflict target for shared predictions**
Migration drops the named constraint `user_expected_results_unique (user_id, match_id)` and replaces it with a partial index `user_expected_results_unique_shared WHERE quiniela_id IS NULL`. The repository still uses `onConflict: 'user_id,match_id'` which requires a named constraint — partial indexes require the index name as conflict target. This breaks all shared-mode prediction saves.

**Critical: Architecture violation — page directly calls repository**
`welcome/page.tsx` (L112) calls `new ExpectedResultsRepository().findByUserIdAndQuiniela(...)` directly, bypassing the service layer. Views must only call services per `docs/modules.md`.

**Important: QuinielaSwitcher shows unapproved quinielas**
`QuinielasRepository.findAllForUser` does not filter by `approved_at IS NOT NULL`. In per_quiniela mode, the welcome page shows all quinielas a user has a membership row in — including pending/unapproved ones — so the switcher can display quinielas the user hasn't been approved to join.

**Important: EC-4 UUID tiebreak missing**
`AppSettingsRepository.findOldestQuinielaId` orders only by `quinielas(created_at) ASC`. The EC-4 tiebreak (lower UUID lexicographically when created_at ties) is not implemented.

**Important: Missing PredictionScoreRepository tests**
No test file exists for `PredictionScoreRepository`. The fan-out logic (`findPredictionsWithQuinielas`) and the non-quiniela-filtered `findCrowdOutcomes` are completely untested.

**Important: Missing `findByUserIdAndQuiniela` repository tests**
`ExpectedResultsRepository.test.ts` has no tests for the new `findByUserIdAndQuiniela` method.

**Important: Missing route handler tests**
No tests for `app/api/admin/settings/route.ts` (GET and PUT) — auth, 403, invalid payload, and success paths all untested.

**Minor: AppSettingsRepository test comment stale**
Comment on line 17 says `.select('id', {count:'exact'})` but actual impl uses `.select('id').limit(1).maybySingle()`.

**Minor: Out-of-scope changes**
`app/_components/Navbar.tsx` and `app/_components/MobileMenuClient.tsx` were modified to add the admin settings nav link — these are not listed in the technical brief's modified files list.

**Fixes confirmed in re-validation (2026-06-02):**
- C1 (PostgREST join): Rewritten as two separate queries + in-memory join in PredictionScoreRepository. Fix confirmed.
- C2 (broken onConflict): Replaced with SELECT→INSERT/UPDATE pattern in ExpectedResultsRepository. Fix confirmed.
- C3 (page calls repository): welcome/page.tsx now calls ExpectedResultsService.findByUserIdAndQuiniela. Fix confirmed.
- I1 (unapproved quinielas): QuinielasRepository.findAllForUser now filters by .not('approved_at', 'is', null). Fix confirmed.
- I2 (EC-4 tiebreak): AppSettingsRepository.findOldestQuinielaId adds .order('quinielas(id)', {ascending:true}) secondary sort. Fix confirmed.
- I3 (PredictionScoreRepository tests): scoring/__tests__/PredictionScoreRepository.test.ts now exists. Fix confirmed.
- I4 (findByUserIdAndQuiniela tests): expectedResults/__tests__/ExpectedResultsRepository.test.ts has full coverage. Fix confirmed.
- I5 (admin settings route tests): app/api/admin/settings/__tests__/route.test.ts exists with full GET+PUT coverage. Fix confirmed.

**Remaining gaps after re-validation:**
- IMPORTANT: PredictionScoreRepository.test.ts does NOT cover upsertBatch or aggregateByQuiniela methods.
- IMPORTANT: AppSettingsRepository test for findOldestQuinielaId does not assert the secondary .order('quinielas(id)') call — EC-4 tiebreak behavior untested.
- IMPORTANT: QuinielasRepository.findAllForUser has no repository-level test (only service mock tests exist).
- MINOR: SELECT→INSERT in ExpectedResultsRepository.upsert has TOCTOU race: concurrent first-inserts for the same key will throw an error (DB constraint catches it but the second caller gets UNKNOWN_ERROR, not a silent idempotent success).

**Why:** This feature modifies both the data model (quiniela_id on predictions, app_settings table) and the UI (mode switcher, admin settings form). The main structural gap is the lack of a FK to support the PostgREST join in scoring, plus the broken conflict target after constraint drop.

**How to apply:** When reviewing scoring/fan-out features, always verify FK paths exist for PostgREST joins. When dropping constraints and replacing with partial indexes, verify all callers update their onConflict strategy. After a fix pass, always check that test coverage reaches ALL public methods on a new repository, not just the most prominent ones.
