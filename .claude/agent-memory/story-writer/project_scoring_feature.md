---
name: project-scoring-feature
description: Three-point scoring engine, global match sync, match cards, and pool leaderboard — major feature in-flight as of 2026-06-01; full story document produced
metadata:
  type: project
---

The scoring + leaderboard feature is the next major delivery. Story produced 2026-06-01.

Key decisions captured in the story:
- Scoring is regulation-time only; extra time and penalties are explicitly excluded.
- Admin-triggered sync only (no scheduled/webhook sync in this story).
- `prediction_scores` is a new table with a unique constraint on `(prediction_id, quiniela_id)` to guarantee idempotent upserts.
- `matches` table needs three new columns: `regulation_team_a_goals`, `regulation_team_b_goals`, `last_synced_at`.
- `user_expected_results` needs `locked_at` — mechanism still unresolved (see open questions).
- `ScoringService` must be pure (no side effects) so it can be unit tested without a database.
- `PredictionScoreRepository` handles persistence; `LeaderboardService` handles aggregation (placement TBD).
- Sync endpoint: `/api/admin/matches/[id]/sync`. Leaderboard page: `/pools/[id]/leaderboard`.

**Why:** This is the first time the app will have a functioning score and ranking system — it is the core gameplay loop. All prior story work (prediction submission, pool membership) is a prerequisite.

**How to apply:** When the user asks about scoring, sync, leaderboard, or MatchCard work, anchor suggestions to the module boundaries in this story. Flag anything that deviates from the idempotency requirement or the regulation-time-only scoring rule. The five open questions below must be resolved before implementation begins — surface them proactively.

Open questions still unresolved at story time (ask before implementing):
1. Leaderboard service placement: inside ScoringService or separate LeaderboardService?
2. Crowd percentage scope: single pool or all pools system-wide?
3. `locked_at` mechanism: background job at kickoff or derived lazily on first score calculation?
4. Admin role definition: global platform admin or individual pool creator?
5. Partial sync failure: commit partial scores or roll back entire sync?

[[user-role]]
