---
name: project-extra-questions
description: Extra Points Questions feature — admin-created open-answer questions with scoring, 4 new tables, ExtraQuestionsRepository/Service/actions, API routes under /api/quinielas/[quinielaId]/extra-questions/
metadata:
  type: project
---

Extra Points Questions feature implemented (2026-06-03):

- Migration: `supabase/migrations/20260610000000_extra_questions.sql` — four tables: extra_questions, extra_question_answers, extra_question_results, extra_question_audit_log
- Module: `extraQuestions/` — types, repository, service, actions.ts
- API routes: `app/api/quinielas/[quinielaId]/extra-questions/` with sub-routes: route.ts (GET+POST), [questionId]/answers/route.ts (POST), [questionId]/resolve/route.ts (POST), teams/route.ts (GET), players/route.ts (GET)
- Scoring extended: `aggregateByQuiniela` now merges `extra_question_results` points; removed early `return []` when prediction_scores is empty so extra-only users appear
- `ICompetitionsRepository` extended with `hasAnyMatches()` and `findDistinctTeams()`
- `IPlayersRepository` extended with `findByTeamExternalIds()`
- `IMembershipsRepository` already had `findByQuinielaAndUser` and `isApprovedMember`

**Why:** Adding bonus points questions feature to quinielas.
**How to apply:** When touching scoring aggregation or extra-questions routes, check that `aggregateByQuiniela` fetches BOTH prediction_scores AND extra_question_results before returning.

[[project-scoring-leaderboard]]
[[project-competitions-module]]
