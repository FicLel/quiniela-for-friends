---
name: extra-questions-feature
description: Extra Points Questions feature — revised 2026-06-02 with PO decisions; all 6 open questions closed; admin creates team/player questions per quiniela, members answer, 1 pt each, merged into leaderboard
metadata:
  type: project
---

Extra Points Questions feature story was fully revised on 2026-06-02. All 6 original open questions closed by product owner decisions.

**Why:** Adds an extra engagement layer on top of match predictions, awarding 1 point per correct extra-question answer, merged into the per-quiniela leaderboard via `LeaderboardService` and `PredictionScoreRepository`. New module is `extraQuestions/`. Three new DB tables: `extra_questions`, `extra_question_answers`, `extra_question_results`.

**Product owner decisions (all 6 open questions closed):**
1. Rescoring after correct-answer change is automatic — no separate button.
2. Player autocomplete scope = only players whose team participates in the competition linked to the quiniela. If no competition is linked, player-type questions are blocked.
3. Floating button only renders when the quiniela has at least one extra question (resolved or unresolved).
4. Floating button badge = count of open (unresolved) questions the current member has NOT yet answered; disappears when all answered.
5. No cap on questions per quiniela — unlimited.
6. Question creation (both team and player types) is blocked if competition data (teams/squad players) has not been loaded for that quiniela. Admin sees an explanatory message.

**How to apply:** Scoring integration targets `scoring/LeaderboardService.ts` and `scoring/PredictionScoreRepository.ts`. Player scope filter goes through `competitions/CompetitionsRepository.ts` + `players/PlayersRepository.ts`. Membership gate via `memberships/MembershipsRepository.ts`.

[[scoring-feature]]
[[user-role]]
