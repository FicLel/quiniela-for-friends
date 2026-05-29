---
name: project-create-first-admin-patterns
description: Recurring patterns and gap types found during Create First Admin screen validation
metadata:
  type: project
---

Create First Admin screen implementation (validated 2026-05-28).

Key patterns observed:

1. **Architecture violation: page.tsx imports Repository directly** — `app/(public)/login/page.tsx` and `actions.ts` both import `UsersRepository` directly, bypassing the services layer. The docs/architecture.md rule is "Views NEVER import repositories or clients directly — only services." This is a recurring risk point.

2. **Validation error masking** — `actions.ts` `createFirstAdmin` returns `UNKNOWN_ERROR` on server-side schema validation failure (line 82), losing the specific error type (`SETUP_ALREADY_COMPLETE` vs a validation problem). This makes client-side error display less precise and was flagged as Important.

3. **One-way cache enforcement** — `usersCache.ts` has no runtime guard preventing `setCachedHasUsers(false)` after `true` was set. The cache semantics rely entirely on call-site discipline. Flagged as Minor (the code is correct because `hasAnyUser` always sets `true` after first user exists, but the module offers no protective enforcement).

4. **Missing test: login page DB-error fallback** — No test verifies that `LoginPage` renders `LoginForm` (not a white screen) when `UsersRepository.hasAnyUser()` throws. This is AC1/AC2 fail-safe behavior from the brief ("fail-safe: DB error → render LoginForm"). Flagged as Important.

5. **Missing test: createFirstAdmin server action** — No test file for `app/(public)/login/actions.ts`. The `createFirstAdmin` action's validation guard (returning `UNKNOWN_ERROR` on schema failure) and cookie-writing path are untested. Flagged as Important.

6. **AC3 cache: module-level singleton only works within same Next.js process** — Verified correct: the brief explicitly calls for module-level singleton. Implementation matches.

**Why:** These patterns help future validations identify where the hexagonal boundary is most often crossed (page.tsx → Repository imports) and where test gaps cluster (page-level server components, server actions).

**How to apply:** When validating future features, immediately grep for Repository imports in `app/` files and check for missing action/page-level tests.
