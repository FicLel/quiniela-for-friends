---
name: project-expected-results-patterns
description: Recurring patterns from Post-Invite Redirect & Match Result Input validation: repository bypass in action cascade, missing leaveQuiniela cascade, non-serializable function prop at server-client boundary, missing Repository test file
metadata:
  type: project
---

## Key findings from this validation run (2026-05-30)

1. **Repository imported directly in action for cascade delete**: `members/actions.ts` L88 calls `new ExpectedResultsRepository().deleteByUserId(...)` directly — bypasses the service layer. Consistent pattern with prior findings (see [[project-users-dashboard-approval-patterns]]).

2. **leaveQuiniela does NOT cascade-delete expected results**: AC13 requires deleting expected results when a player is removed from every quiniela. `removeMember` action handles this, but `leaveQuiniela` action does not — leaving a gap if an admin self-removes and has no other memberships.

3. **Inline async wrapper passed as function prop from Server to Client Component**: `welcome/page.tsx` L134-136 passes an inline async arrow function (not a server action) as `onSaveScore` prop. This prop flows through Server Components (`WelcomeMatchList`, `KnockoutSection`) down to Client Components (`DateGroupedView`, `GroupAccordion`, `MatchCard`). React requires props crossing server-to-client boundary to be serializable; non-server-action functions are not. Should be the direct server action reference or have `'use server'` inline.

4. **Missing ExpectedResultsRepository.test.ts**: Technical brief explicitly required this file. Only `ExpectedResultsService.test.ts` is present.

5. **RLS only has service_role policy**: Consistent with project pattern — all tables use only service_role bypass. No user-facing RLS policies. This is by design (service-role key only used server-side).

6. **unauthenticated saveExpectedResult returns NOT_APPROVED not a distinct error**: Unauthenticated callers get the same `NOT_APPROVED` error as non-approved authenticated users. Acceptable but mixes two distinct failure modes.

**Why:** These patterns keep recurring because the brief often adds cascade operations and repository bypass is the fastest path.
**How to apply:** Always check `leaveQuiniela` AND `removeMember` for cascade operations when expected results deletion is in scope. Always verify Server Component function props have `'use server'` or are direct server action imports.
