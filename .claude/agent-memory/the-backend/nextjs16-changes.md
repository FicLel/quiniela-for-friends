---
name: nextjs16-changes
description: Next.js 16 breaking changes confirmed from node_modules/next/dist/docs — Middleware is now Proxy
metadata:
  type: project
---

Next.js 16 renamed Middleware to Proxy. Confirmed from `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`:

- File must be named **`proxy.ts`** (not `middleware.ts`) at the project root.
- Export a named **`export function proxy(request: NextRequest)`** or a default export.
- The `config.matcher` export works the same way.
- `next/headers` `cookies()` is NOT available in proxy context — use `createServerClient` with `request.cookies.get` / `response.cookies.set` adapter instead.
- `redirect()` is imported from `next/navigation` (unchanged).
- `'use server'` directive goes at the top of the file for Server Functions files (unchanged).

**Why:** Training data contains Next.js 13/14/15 patterns. Getting this wrong would silently create a broken file (middleware.ts would be ignored).
**How to apply:** Always read `node_modules/next/dist/docs/` before writing any Next.js-specific conventions (routing, proxy, server actions).
