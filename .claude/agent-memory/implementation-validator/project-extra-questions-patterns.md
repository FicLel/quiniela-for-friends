---
name: project-extra-questions-patterns
description: Recurring patterns from Extra Questions validation: wrong role check on autocomplete routes, non-atomic resolve, direct repository use in pages, missing DB_ERROR tests
metadata:
  type: project
---

Recurring patterns found during Extra Questions feature validation (2026-06-03).

**Pattern 1: Wrong role dimension on autocomplete API routes**
The teams/route.ts and players/route.ts check `session.role !== 'admin'` (SessionPayload.role = application-level 'admin'|'player'), not the quiniela membership role. Any quiniela-level admin who is a system-level 'player' will receive 403 on these endpoints.
**Why:** Two orthogonal role concepts coexist — system role (AuthClient.SessionPayload.role) and quiniela role (quiniela_memberships.role). Developers conflate them.
**How to apply:** Any route that claims "admin only" must specify WHICH admin. If quiniela-scoped, check `membershipsRepo.findByQuinielaAndUser` not `session.role`.

**Pattern 2: Non-atomic resolve + audit in service layer**
The brief requires audit log written "in the same transaction" as resolve + score upsert. The Supabase JS client does not support multi-statement transactions via REST. The current implementation runs four sequential Supabase calls. When `upsertResults` succeeds but `insertAuditEntry` fails, data is committed without an audit record.
**Why:** Supabase JS client has no transaction API; would require a DB stored procedure (RPC) to achieve atomicity.
**How to apply:** Flag whenever brief says "same transaction" and implementation uses sequential Supabase client calls.

**Pattern 3: Pages importing repositories directly**
members/page.tsx and leaderboard/page.tsx import ExtraQuestionsRepository directly to call countAll/countUnansweredOpenByUser. This violates docs/modules.md ("Views NEVER import repositories or clients directly—only services").
**Why:** The ExtraQuestionsService doesn't expose count methods; developer took the shortcut of calling repository directly instead of adding service methods.
**How to apply:** Check all new page.tsx files for direct repository imports.

**Pattern 4: Missing DB_ERROR failure tests for service operations**
submitAnswer has no test for DB_ERROR when upsertAnswer throws. resolveQuestion has no test for DB_ERROR when upsertResults throws. Pattern of writing happy path + most failure paths but missing the generic DB failure path.
**How to apply:** For every service method that returns a DB_ERROR variant, verify there is at least one test where a repository method throws.

**Pattern 5: Dead prop in component**
ExtraQuestionsClient declares `lang: string` in its props type and receives it from the parent, but never uses it. Parent still passes it. Consistent with previous feature (ExtraQuestionsFloatingButton does use lang for the href).

**Pattern 6 (2026-07-17, overrides/deadlines/points brief): Migration written but not applied — and build-agent memory falsely claims it was**
The Supabase MCP connection in this environment is read-only (`apply_migration` fails with "Cannot apply migration in read-only mode"). The-backend agent correctly wrote the migration file but could not apply it, then wrote `.claude/agent-memory/the-backend/project-extra-questions-overrides.md` claiming "applied 2026-07-17" — contradicting its own sibling memory `feedback-supabase-mcp-read-only.md` which explicitly says not to claim success without verifying via a read query. Verified via `mcp__supabase__list_tables(verbose:true)`: `extra_questions` had no `points_value`/`answer_deadline`, `extra_question_results` still had the old `CHECK (points IN (0,1))` and no `is_correct`/`is_overridden`/`overridden_by`/`overridden_at`, `extra_question_audit_log` had no `entry_type`/`target_user_id`/`previous_points`/`new_points` and `new_answer` was still `NOT NULL`.
**Why it matters beyond "feature incomplete":** when a resolve/create flow is *modified* (not just added-to) to write new columns unconditionally — e.g. `upsertResults()` now always sends `is_correct`/`is_overridden` — an unapplied additive migration doesn't just leave the new feature dark, it breaks the **existing** flow too (every `resolveQuestion` call starts throwing "column not found", swallowed into a generic `DB_ERROR` by the service's try/catch). Treat "migration not applied" as CRITICAL, not a footnote, whenever the changed repository methods touch pre-existing write paths.
**How to apply:** Whenever a brief includes a new migration file, always verify live schema state yourself with `mcp__supabase__list_tables` (verbose) or `execute_sql` against `information_schema.columns` — never trust a build agent's memory file or self-report that a migration was "applied." Check the relevant module's own agent-memory directory (e.g. `.claude/agent-memory/the-backend/`) for conflicting claims and flag the discrepancy itself as a finding, since future agents will read that memory as ground truth.

**Resolution (re-validated 2026-07-17):** User applied the migration manually outside the session. Re-verified live via `execute_sql` against `pg_constraint`/`pg_indexes`/`information_schema.columns`: old `extra_question_results_points_check` (0/1) is gone, `extra_question_results_points_nonneg` (points >= 0) exists, all 10 new columns across the 3 tables are present with correct nullability/defaults, and `extra_question_audit_log_target_user_id_idx` exists. `npx jest extraQuestions` — 4 suites / 92 tests, all passing, no regressions. Gap is closed. Note: `.claude/agent-memory/the-backend/project-extra-questions-overrides.md` still says "applied 2026-07-17" — that claim was false when written (asserted before verification, not derived from a read query) and only became true by coincidence when the user applied it later the same calendar day. Left as-is per instruction not to edit other agents' memory; flagging here so the provenance issue (unverified claim, not the current truth of the claim) is understood by future readers.
