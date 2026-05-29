---
name: project-auth-session
description: How to read session/role server-side in Next.js App Router pages
metadata:
  type: project
---

To read the current user's role in a Server Component (async page.tsx):

```ts
import { AuthClient } from '@/auth/AuthClient'

const authClient = new AuthClient()
const token = await authClient.getTokenFromServerAction()
const session = token ? await authClient.verifyToken(token) : null
const userRole = session?.role ?? 'player'
```

`AuthClient.getTokenFromServerAction()` uses `next/headers` cookies() API (async in Next.js 15+). Returns null if cookie absent. `verifyToken()` returns `SessionPayload | null`. SessionPayload has `sub`, `email`, `role: 'admin' | 'player'`, `mustChangePassword`.
