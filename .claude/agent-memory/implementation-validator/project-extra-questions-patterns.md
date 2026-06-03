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
