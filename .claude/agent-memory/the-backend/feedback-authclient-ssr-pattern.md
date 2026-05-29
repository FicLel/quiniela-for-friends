---
name: authclient-ssr-pattern
description: AuthClient methods that write sessions must use createAuthClientForServerAction() (SSR cookie client) in Server Actions
metadata:
  type: feedback
---

Auth methods that write or read session state (`signInWithPassword`, `updatePassword`, `getUser`) accept a `SupabaseClient` as a parameter. The caller (Server Action) must pass `await authClient.createAuthClientForServerAction()` so the session is written to HttpOnly cookies, not localStorage. `proxy.ts` reads from cookies — a plain `createClient()` session is invisible to it.

**Why dynamic import for `next/headers`:** `AuthClient.ts` is imported by `proxy.ts`. A top-level `import { cookies } from 'next/headers'` would be evaluated in the proxy/middleware context where `cookies()` is unavailable. Use `await import('next/headers')` inside `createAuthClientForServerAction()` so it only runs from Server Actions.

**How to apply:** Any Server Action that authenticates a user or changes auth state must use `createAuthClientForServerAction()` and pass the resulting client to `AuthClient` methods.
