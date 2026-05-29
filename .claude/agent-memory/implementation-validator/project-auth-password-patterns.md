---
name: project-auth-password-patterns
description: Recurring patterns and gap types from Email+Password login validation run (2026-05-26), post-fix pass
metadata:
  type: project
---

Validated the Email+Password + forced-password-change feature after a round of fixes. Key findings that recur or are non-obvious:

**Type surface mismatch (LoginErrorCode vs LoginResult):** The `login()` server action returns `LoginResult` (error codes: `INVALID_CREDENTIALS | UNKNOWN_ERROR`) but `LoginForm.tsx` stores and displays errors as `LoginErrorCode` (which also includes `VALIDATION_ERROR`). The UI adds a third code (`VALIDATION_ERROR`) that the server never returns — these two types diverge deliberately but are not enforced by a shared type. Future validators should check that UI error state types remain a superset of server result error types, not a different set.

**changePassword action validation ordering (I2 was fixed):** The server action at `app/(private)/auth/change-password/actions.ts` checks `hasConfirmError` from Zod issues to decide between `PASSWORDS_DO_NOT_MATCH` and `POLICY_VIOLATION`. However, Zod's `.refine()` for the mismatch check only runs if both fields individually pass their own validators — so a password that fails the policy AND mismatches will always return `POLICY_VIOLATION` first from Zod. The client-side guard in `ChangePasswordForm.tsx` checks policy before mismatch, matching this server behavior.

**Proxy duplicates DB lookup:** `proxy.ts` reads `mustChangePassword` from DB twice for any authenticated non-login route (once for the login-redirect branch, separately for the private-route branch). This is a structural issue in the proxy that may cause double DB round-trips.

**`expo-sqlite` as a production dependency:** `package.json` includes `expo-sqlite` in `dependencies` — this is a mobile SDK unrelated to this Next.js/Supabase project. Likely a leftover from project scaffolding.

**No proxy/middleware unit tests exist.** The routing logic in `proxy.ts` is entirely untested. All AC points related to redirect behavior (AC1, AC5, AC6, AC10, AC11, AC14) rely solely on the proxy code being manually verified.

**`UsersRepository` integration tests are all skipped.** The file exists as a placeholder with `describe.skip`. The actual persistence layer has no running test coverage.

**Why/How to apply:** When validating future auth or routing features, always check (1) type surface alignment between server action return types and client error state types, (2) whether proxy routing logic has tests, (3) whether repository integration tests are merely stubs.
