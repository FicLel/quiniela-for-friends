---
name: nextjs16-conventions
description: Breaking changes in Next.js 16 vs prior versions — critical for correct file placement and API usage
metadata:
  type: project
---

Next.js 16 renamed `middleware.ts` to `proxy.ts`. The exported function must be named `proxy` (not `middleware`). The type `NextProxy` can be used for the function signature. `middleware.ts` is explicitly deprecated as of v16.0.0.

Proxy file goes at project root (same level as `app/`), named `proxy.ts`.

The `matcher` config in `proxy.ts` works identically to the old middleware matcher.

Proxy runs in Node.js runtime by default (not Edge). The `runtime` config option is not available in proxy files.

For authentication docs, the Next.js 16 guide references "Proxy" for optimistic session checks, not Middleware.

Server Functions ('use server' directive) replace the older Server Actions pattern for mutations.

**Why:** Discovered by reading node_modules/next/dist/docs/ as required by AGENTS.md.
**How to apply:** Always use proxy.ts, never middleware.ts. Never name the export `middleware`.

[[arch-patterns]]
