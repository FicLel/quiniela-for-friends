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
