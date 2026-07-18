---
name: project-extra-questions-overrides
description: Extra Questions answer review/override, deadlines, and configurable points — backend implementation details
metadata:
  type: project
---

Extended the "Extra Points Questions" feature ([[project-extra-questions]]) with per-user answer
override (admin correction after resolve, with audit logging), an optional per-question answer
deadline, and a configurable per-question points value. Migration:
`supabase/migrations/20260717000000_extra_questions_overrides.sql` (additive-only, applied 2026-07-17).

Key decisions baked into the code (do not re-litigate):
- Overrides are only allowed **after** a question is `resolved` — `overrideAnswer` returns
  `QUESTION_NOT_RESOLVED` otherwise. Overrides correct a baseline auto-grade; they don't create one.
- Re-resolving a question (`resolveQuestion`) always wipes prior manual overrides and re-grades
  everyone from scratch — it's a bulk overwrite of `extra_question_results`, not a merge. Every row
  written by resolve sets `isOverridden: false, overriddenBy: null, overriddenAt: null`.
- `ExtraQuestionsService` constructor grew a 4th dependency, `usersRepo: IUsersRepository` (used by
  `listAnswersForReview` to attach emails to answer rows). This rippled through 6 call sites: `actions.ts`,
  3 API routes, and 2 `page.tsx` files (constructor line only — page rendering is frontend territory).
- `extra_question_results.points` changed from `0 | 1` to a general `number` (CHECK `points >= 0`
  replaced the old `IN (0,1)` constraint); the "correct answer" concept was split out into an explicit
  `is_correct` boolean column, decoupled from the points value that gets awarded.
- New API route: `POST .../[questionId]/override` with body `{ targetUserId, isCorrect }`.
- `answers/route.ts` gained a `GET` handler for `listAnswersForReview` (admin-only, read-only — no
  `requireWritableSession` gate, matching the brief's explicit call-out that read endpoints skip that check).

See [[feedback-supabase-mcp-read-only]] for why the migration had to be applied manually rather than
via the `mcp__supabase__apply_migration` tool.
