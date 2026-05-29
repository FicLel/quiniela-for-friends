---
name: nextjs16-server-actions-client
description: Next.js 16 / React 19 patterns for calling server actions from client components — use useState + useTransition, not useFormState
metadata:
  type: feedback
---

In Next.js 16 with React 19, the recommended pattern for calling server actions from client components is:
- `useTransition` from React for pending state (`isPending`)
- `useState` for managing local error/result state
- Call the server action inside `startTransition(async () => { ... })`

Do NOT use the deprecated `useFormState` (React 18 pattern). `useActionState` is available from React as `import { useActionState } from 'react'` but the simpler useState+useTransition pattern is cleaner for two-step forms.

**Why:** The docs in `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` confirm `useActionState` is the React 19 hook. For multi-step forms with state transitions, useState+useTransition gives finer control.

**How to apply:** Always read `node_modules/next/dist/docs/` for the current API. The `redirect()` in server actions throws a control-flow exception — verifyOtp never returns `{ success: true }` to the client; if it returns, it's always a failure.
