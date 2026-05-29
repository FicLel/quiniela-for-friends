---
name: project-auth-otp-patterns
description: Recurring patterns and gap types found during the Email OTP login feature validation run
metadata:
  type: project
---

During the Email OTP login feature validation, the following recurring patterns and gap types were observed:

**Proxy file naming:** Next.js 16 uses `proxy.ts` (not `middleware.ts`) at the project root. The matcher uses the standard `config` export. This was correctly implemented.

**getSession vs getUser in proxy:** The proxy uses `supabase.auth.getSession()` to protect routes. Per Supabase SSR docs, `getSession()` reads the JWT from the cookie but does NOT re-validate it against the server — it can be spoofed. The secure pattern is to call `supabase.auth.getUser()` instead, which validates the token server-side. This was a gap found in this codebase. See [[supabase-sdk-gotchas]] in the-backend agent memory.

**Revoked refresh token path (AC-10):** No code path exists to detect a revoked/expired refresh token and clear the session + redirect. The proxy only checks if a session exists at the cookie level; it does not handle the case where the refresh token has been revoked in Supabase (which would surface as a `getUser()` error). This gap is currently masked by using `getSession()` instead of `getUser()`.

**Test environment mismatch:** The LoginForm component tests use `@jest-environment jsdom` (docblock) but `jest.config.js` sets `testEnvironment: 'node'`. The docblock overrides the global setting per file so this works, but it signals that the jest config default is wrong for a project with React component tests.

**Missing LoginForm test scenarios:** The LoginForm test file does not cover VALIDATION_ERROR (malformed email caught client-side before the server call) nor UNKNOWN_ERROR server failure display.

**No tests for proxy.ts / server actions:** No unit or integration tests exist for `proxy.ts` or `app/(public)/login/actions.ts`.

**Why:** These gaps matter because auth is a critical security boundary. getSession spoofability is a known Supabase SSR footgun documented in their own migration guides.

**How to apply:** In future validations of auth-related code, always check whether `getSession` or `getUser` is used in middleware/proxy, and flag `getSession` as a security concern when used for route protection decisions.
