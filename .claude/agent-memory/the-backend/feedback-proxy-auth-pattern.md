---
name: proxy-auth-pattern
description: Correct auth check pattern in proxy.ts — use getUser() not getSession(), handle error for revoked tokens
metadata:
  type: feedback
---

Always use `supabase.auth.getUser()` (not `getSession()`) for route protection in `proxy.ts`.

**Why:** `getSession()` reads the JWT from cookies without server validation — a tampered or replayed cookie passes the guard. `getUser()` makes a network call to Supabase Auth to verify the token server-side.

**How to apply:** In `proxy.ts`, after `await supabase.auth.getUser()`, destructure `{ data: { user }, error }`. Redirect to `/login` on private routes if `error || !user`. Redirect to `/dashboard` on `/login` only if `!error && user`. See [[supabase-sdk-gotchas]] for related notes.
