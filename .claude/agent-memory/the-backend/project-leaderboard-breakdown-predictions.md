---
name: project-leaderboard-breakdown-predictions
description: Leaderboard scoring breakdown + player predictions viewer: 4 new breakdown fields on LeaderboardRow, PlayerPredictionEntry type, findPlayerPredictionsForViewer repo method, getPlayerPredictions service method, new API route
metadata:
  type: project
---

The leaderboard scoring breakdown + predictions viewer feature adds:
- 4 new breakdown fields on `LeaderboardRow` (`homeGoalPoints`, `awayGoalPoints`, `outcomePoints`, `extraQuestionPoints`)
- New `PlayerPredictionEntry` type in `scoring/scoring.types.ts`
- `findPlayerPredictionsForViewer(quinielaId, userId)` on `IPredictionScoreRepository` and `PredictionScoreRepository`
- `getPlayerPredictions(quinielaId, userId)` on `ILeaderboardService` and `LeaderboardService`
- New API route `GET /api/quinielas/[quinielaId]/members/[userId]/predictions`

**Why:** Frontend leaderboard viewers need per-category point breakdowns and the ability to view any approved member's predictions match-by-match.

**How to apply:** When the frontend renders a player predictions drawer/modal, it calls this route. Access control: any approved member may view any other member's predictions (caller's `session.sub` is checked, not `userId`).

## Key implementation notes

- `aggregateByQuiniela` accumulates `homeGoalPoints`/`awayGoalPoints`/`outcomePoints` in the prediction_scores loop, and `extraQuestionPoints` in the extra_question_results loop. The extra-only user zero-initializer was also updated to include the 4 new fields.
- `findPlayerPredictionsForViewer` uses a 2-step query: (1) prediction_scores join user_expected_results filtered by quiniela_id + user_id, (2) fetch matches by ID set. In-memory filter to FINISHED with non-null regulation goals.
- The mock for the two-chain `.eq()` on `prediction_scores` in tests distinguishes `aggregateByQuiniela` vs `findPlayerPredictionsForViewer` by checking whether the select string contains `match_id`.
- Updating `LeaderboardRow` type required fixing fixtures in the frontend test `LeaderboardClient.test.tsx` — this is acceptable since it's test data, not component code.

[[project-scoring-leaderboard]]
