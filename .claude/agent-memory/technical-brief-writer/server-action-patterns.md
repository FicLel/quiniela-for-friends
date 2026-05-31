---
name: server-action-patterns
description: Server Action conventions — 'use server' files, auth check pattern, redirect placement, factory wiring
metadata:
  type: project
---

Server Actions live in `app/[lang]/.../<route>/actions.ts` with `'use server'` directive at top.

Auth check pattern:
```ts
const authClient = new AuthClient()
const token = await authClient.getTokenFromServerAction()
const session = token ? await authClient.verifyToken(token) : null
if (!session) return { success: false, error: 'UNKNOWN_ERROR' }
```

Service factory wiring: services are newed inline in the action — no DI container.

redirect() rules:
- MUST NOT be inside a try/catch — it throws internally.
- Place redirect() AFTER the try/catch block that wraps the service call.

Return types: discriminated union `{ success: true; ... } | { success: false; error: 'ERROR_CODE' }`.

**Why:** Pattern used consistently across all 6 existing actions.ts files.
**How to apply:** Every new server action must follow this structure exactly.
