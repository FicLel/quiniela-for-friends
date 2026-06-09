---
name: project-scoring-leaderboard-patterns
description: Recurring patterns from Three-Point Scoring, Match Cards & Leaderboard validation — earnedPoints wiring gap, crowd percentage false-null, isMember approval gap, missing syncRegulationResults tests
metadata:
  type: project
---

Patterns observed in the Three-Point Scoring / Leaderboard story validation (2026-06-01):

**Why:** These were real gaps found during validation.
**How to apply:** Watch for these in future scoring-related stories.

1. **earnedPoints always null on welcome page** — page.tsx sets `earnedPoints: null` with a comment "fetched below" but never fetches per-user scores. AC-15/16 (final state shows points) is not wired end-to-end despite ScoringService and PredictionScoreRepository implementing the aggregation correctly.

2. **Crowd percentages false-null for all-draw matches** — page.tsx checks `homeWinPct > 0 || drawPct > 0 || awayWinPct > 0` to detect real data, but a match where 100% of predictions are draws (only `drawPct` > 0, others 0) is correctly detected. However a match where all predictions are exactly 0 home wins AND 0 away wins AND 0 draws (impossible but edge case) would falsely show "No predictions yet". More important: if ALL predictions are draws but getCrowdPercentages returns {0, 33, 0} that would still trigger. Real gap: a match where ALL predictions are the home-win outcome but homeWinPct rounds to 0 due to small sample (e.g. 1 prediction out of 200+ gives 0% via Math.floor) — very edge case.

3. **isMember does not filter approved_at** — MembershipsRepository.isMember (L158) checks existence but not approval. Leaderboard page and API route use this for member access control, allowing unapproved members to view the leaderboard.

4. **syncRegulationResults not tested in CompetitionsService.test.ts** — entire new method has zero test coverage.

5. **"Predictions closed" label is hardcoded English** — not wired to dict, breaks i18n.

6. **No LeaderboardService unit tests exist** — only LeaderboardClient UI tests exist; the service sorting/tiebreak logic is untested.

7. **Leaderboard page directly instantiates repositories** — arch violation: page imports LeaderboardService directly (acceptable per architecture) but also imports PredictionScoreRepository and UsersRepository (infrastructure layer) directly in the view — same anti-pattern as previous stories.

**Scoring Breakdown + Predictions Viewer validation (2026-06-09):**

8. **PostgREST embedded filter (`.eq('relation.column', value)`) does NOT filter rows at the DB level when using `!inner` join** — it filters columns on the related record, not which parent rows are returned. In `findPlayerPredictionsForViewer`, `.eq('user_expected_results.user_id', userId)` combined with `!inner` performs an INNER JOIN and applies the filter on the related row, which effectively IS a row-level filter in PostgREST v2+. This is actually the correct behavior — but it is subtle and easy to mistake for a bug. Documented for future reference.

9. **Mobile grid column count mismatch vs. AC2** — AC2 specifies 5 columns on mobile: Rank, Player, Exact Score Hits, Correct Outcome Hits, Total Pts. The implementation uses `grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem]` (5 tracks) with visible headers for #, Player, Exact, Outcome, and then Total Pts — but the 5th visible column is labeled "Out." (Correct Outcome) not Total Pts in the mobile header area. Total Pts header is unconditionally rendered as a 9th grid item. Grid items beyond 5 wrap onto new lines in a 5-column grid. The Total Pts value renders in the 9th grid slot (item 9 of 10 defined), not in slot 5. This means on mobile the Total Pts column does not appear in the correct slot — it flows into a second row.

10. **`aggregateByQuiniela` prediction_scores DB error path is untested** — the `mockPredictionScoresEq` mock is never given `{ error: {...} }` in any test. The `if (error) throw` branch in the first DB call has no test coverage.

11. **`viewerLoading` key used with `?? 'Loading…'` fallback** — the `??` guard is unnecessary since the key is present in both dictionaries but harmless.

12. **`colOutcomePts` header value collides with `colOutcome` header value in en.json** — both are `"Out."`, making them indistinguishable visually and by title attributes. es.json also uses `"Res."` for `colOutcomePts` and `"Result."` for `colOutcome` — disambiguated in Spanish but identical in English. This is a minor UX issue.

13. **No focus-trap in PlayerPredictionsModal** — modal does not trap keyboard focus, violating WCAG 2.1 dialog pattern. The brief does not explicitly require focus-trap but `role="dialog"` + `aria-modal="true"` implies it.
