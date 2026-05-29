---
name: auth-module-patterns
description: Established patterns in the auth module: AuthClient JWT methods, AuthService constructor injection, Server Action wiring, and proxy cookie strategy
metadata:
  type: project
---

AuthClient is a plain class (not Supabase SSR-based). It wraps `jose` for JWT HS256 signing/verification.
Key methods:
- `getTokenFromServerAction()` — async, dynamic-imports `next/headers` cookies(), for use in 'use server' actions only.
- `getTokenFromRequest(request)` — sync, reads from NextRequest.cookies, for use in proxy.ts only.
- `setSessionCookieOnServerAction(token)` — async, dynamic-imports `next/headers`, sets HttpOnly cookie.
- `verifyToken(token)` — async, returns `SessionPayload | null`.
- `createToken(payload)` — async, returns compact JWT string.

Never cross-use SSR cookie helpers: next/headers is not available in proxy context.

AuthClient is the ONLY file that imports from `jose`.

SessionPayload shape: `{ sub: string; email: string; role: 'admin' | 'player'; mustChangePassword: boolean }`.

`requireEnv(name)` is a private module-level helper — pattern to replicate in new clients.

AuthService takes AuthClient and IUsersRepository via constructor injection.
Unit test mock type: `Partial<Record<keyof AuthClient, jest.Mock>>` cast to `AuthClient`.

Server Actions wire together: `'use server'` directive at file top → schema validation → `new AuthClient()` → read + verify session cookie → `new Repository()` → `new Service(client, repo)` → call service method → on success write cookie and `redirect()`.

`redirect()` from `next/navigation` throws a control-flow exception — no code runs after it on the success path.

proxy.ts is named `proxy.ts` (not middleware.ts) and exports `proxy` function + `config` matcher.

**Why:** Observed from reading AuthClient.ts, AuthService.ts, change-password/actions.ts, proxy.ts.
**How to apply:** All new modules follow this same wiring pattern. New *Client.ts files use the same `requireEnv` pattern and JSDoc noting execution context.

[[arch-patterns]]
[[nextjs16-conventions]]
