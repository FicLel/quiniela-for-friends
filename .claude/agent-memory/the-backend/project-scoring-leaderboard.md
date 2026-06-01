---
name: project-scoring-leaderboard
description: Three-point scoring, regulation results sync, crowd percentages, and leaderboard feature — schema, services, repos, and API routes added in June 2026
metadata:
  type: project
---

Scoring/leaderboard feature implemented June 2026.

**What was added:**
- Migration `20260605000000_scoring_regulation_results.sql`: adds `regulation_home_goals`/`regulation_away_goals`/`last_synced_at` to `matches`; adds `locked_at`/`submitted_at` to `user_expected_results`; creates `prediction_scores` table with 3-point scoring columns.
- New `scoring/` module: `scoring.types.ts`, `ScoringService.ts`, `PredictionScoreRepository.ts`, `LeaderboardService.ts`, `__tests__/ScoringService.test.ts`
- `competitions/` extended: `Match` type got 3 new fields; `ICompetitionsRepository` got `findById`, `updateRegulationResults`, `findKickoffAt`; `ICompetitionsService` + `CompetitionsService` got `syncRegulationResults`; `CompetitionsRepository` implements new methods + updated `toMatch()` mapper
- `expectedResults/` extended: `ExpectedResult` got `lockedAt`/`submittedAt`; `SaveExpectedResultResult` got `LOCKED` error; `IExpectedResultsRepository` got `findByMatchId`; `IMatchKickoffReader` port added; `ExpectedResultsService` accepts optional `kickoffReader` (3rd constructor param); `ExpectedResultsRepository.upsert` now does a pre-check select before inserting (to set `submitted_at` only on first insert).
- API routes: `app/api/admin/matches/sync/route.ts` (POST, admin only), `app/api/pools/[poolId]/leaderboard/route.ts` (GET, member only)

**Why:** Scoring + leaderboard needed for World Cup 2026 prediction pools.

**How to apply:** When working in these modules, be aware of the `IScoringService` circular dependency pattern — `CompetitionsService` takes an optional `scoringService?: IScoringService` to avoid circular imports (scoring depends on competitions types, competitions service depends on scoring service interface).

[[project-competitions-module]]
[[project-expected-results]]
