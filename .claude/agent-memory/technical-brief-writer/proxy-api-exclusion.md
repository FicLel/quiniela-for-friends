---
name: proxy-api-exclusion
description: proxy.ts matcher excludes all /api/* routes — proxy cannot be used to guard API route mutations
metadata:
  type: project
---

`proxy.ts` (project root) matcher:
```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

This means `/api/**` route handlers NEVER run through `proxy.ts`. Any cross-cutting guard that must cover both page-level Server Actions AND `/api/*` route handlers (e.g. a write-block guard, a role check, a feature flag) CANNOT be implemented solely in `proxy.ts` — it must be a shared helper function called explicitly by each handler (Server Action and API route alike), since every handler already independently derives its session via `AuthClient.getTokenFromServerAction()` + `verifyToken()`.

**How to apply:** When asked to design a "global" guard/middleware for mutations or any cross-cutting auth concern, default to "shared helper called by every handler" rather than "proxy.ts middleware," unless the concern is purely about page navigation (redirects for unauthenticated/locale/mustChangePassword — which is what proxy.ts currently does).

[[auth-module-patterns]]
[[nextjs16-conventions]]
