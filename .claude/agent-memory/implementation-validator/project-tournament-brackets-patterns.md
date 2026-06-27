---
name: project-tournament-brackets-patterns
description: Recurring patterns and gap types from Tournament Brackets validation — predictionMode bypass, GD-tiebreak simulation soundness, tab-gated UI element, orphaned route, jest shell-quoting trap
metadata:
  type: project
---

Patterns observed in the Tournament Brackets feature validation (2026-06-25):

**Critical: New read-side services that consume predictions must check `AppSettingsService.predictionMode` before calling `findByUserIdAndQuiniela`**
`TournamentBracketService.getBracketForMember` always calls `findByUserIdAndQuiniela(userId, quinielaId)` with the real quinielaId. In `shared` prediction mode (the actual default), predictions are stored with `quiniela_id = NULL`, so this call returns nothing — the feature silently shows "no prediction" for every match in shared mode. The correct reference pattern lives in `app/[lang]/(private)/welcome/page.tsx` (~L79-112): branch on `predictionMode === 'per_quiniela' ? activeQuinielaId : null` before querying. Any new feature reading `user_expected_results` must replicate this branch — it is easy to miss because per-quiniela-mode-only tests look completely correct in isolation.

**Critical: Combinatorial/Monte-Carlo-style projections must simulate the true outcome range, not just W/D/L**
`GroupProjectionService.simulateFixture` only ever produces 1-0/0-0/0-1 score deltas for remaining fixtures, which is sufficient for points-based certainty but understates goal-difference swings. Any "never assert a false positive" qualification/elimination projection that includes GD as a tiebreak must either simulate a wide goal range or conservatively fall back to UNDECIDED whenever a GD-dependent tie exists — a fixed ±1 simulation can produce exactly the false-positive the spec forbids. Watch for this pattern whenever a brief asks for "enumerate all mathematically possible outcomes" — check whether the simulated *magnitude* of each outcome, not just its W/D/L category, actually matters to the downstream ranking.

**Important: Gating a "must not be omitted" UI element behind active-tab state is a recurring AC violation shape**
The third-place bracket branch ([[project-tournament-brackets-patterns]] itself) was gated to render only `effectiveActiveStage === 'FINAL'`, contradicting the AC's "not a dead end, not omitted" requirement — and the builder's own test (`TournamentBracketClient.test.tsx`) explicitly pins the hidden-elsewhere behavior as expected, which means tests passing is not sufficient evidence of AC compliance; always re-read what the test asserts, not just whether it's green.

**Important: New private routes need an explicit nav-link check, not just a working page.tsx**
The bracket page itself was fully correct and reachable by direct URL, but no file in `app/_components/Navbar.tsx` / `MobileMenuClient.tsx` links to it — confirmed via `git diff --stat HEAD` showing neither file touched. The existing pattern for a per-quiniela sub-page nav link is `app/_components/QuinielaLeaderboardNav.tsx` (handles 0/1/many quinielas cases with a dropdown). Any new per-quiniela page should be checked against this pattern; "the AC is satisfiable by visiting the URL directly" is not the same as "the feature is reachable," and user stories that say "so I can... on mobile" imply discoverability.

**Process note: jest path-pattern shell quoting traps on Windows bracket-heavy paths**
Running `npx jest "<literal-file-path>"` (passing a full absolute path as a positional arg, no `--testPathPatterns`) against paths containing `[lang]`/`(private)`/`[quinielaId]` silently ignores the filter and runs the ENTIRE suite (969 tests), producing misleading "5 failed" results that look like they belong to the target file but are actually the pre-existing unrelated `ImportMatchesButton.test.tsx` failures bleeding into stdout. Always use `npx jest --testPathPatterns="<regex-fragment>"` (not the bare positional arg, not the deprecated `--testPathPattern`) when validating in this repo, and sanity-check the "Test Suites: N" line matches the number of files you intended to target.

**Confirmed correct (no gap) — worth remembering as a baseline pattern:**
- Access-gate-before-cache-read ordering: `TournamentBracketService` checks `isApprovedMember` BEFORE consulting Layer-2 cache, so a mid-session membership revocation takes effect on the very next request even if a stale cache entry would otherwise exist. This is the correct pattern for any per-tenant cache layered on top of an access gate — re-verify the gate runs first whenever a new cached service is reviewed.
- Cross-tenant Layer-2 cache regression tests (different quinielaId same user; different user same quinielaId) were present and correct — this project consistently has a high bar for this specific test shape now (see also [[project-per-quiniela-predictions-patterns]], [[project-scoring-leaderboard-patterns]]).
- All 4 `matches`-table write paths in `CompetitionsRepository` (`upsertMatches`, `upsertKnockoutPlaceholders`, `updateRegulationResults`, `updateKnockoutTeams`) correctly call both `tournamentBracketCache.invalidateLayer1()` and `.clearLayer2()` — confirmed via diff, not just self-report.
- `ExpectedResultsRepository.upsert`'s new `invalidateBracketCacheForWrite` correctly distinguishes per-quiniela (single-key invalidate) vs shared-mode (fan-out across all approved memberships) — mirrors the established fan-out pattern from `PredictionScoreRepository.findPredictionsWithQuinielas`.

**Why:** These were real gaps and real confirmed-correct patterns found during validation of a feature with no new DB tables/migrations and no new API routes — entirely cache + derived-view based.
**How to apply:** For any future "read-only derived view over existing data" feature in this codebase, check (1) does it respect the prediction-mode setting if it touches predictions, (2) does any combinatorial/projection logic's simulation granularity actually match what the ranking decision needs, (3) is the new page linked from nav, (4) does the access gate run before any cache read, not after.
