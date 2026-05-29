---
name: supabase-sdk-gotchas
description: Supabase JS SDK v2 admin API limitations — no getUserByEmail, use listUsers + filter instead
metadata:
  type: project
---

The `@supabase/supabase-js` v2 admin API (`supabase.auth.admin`) does NOT have a `getUserByEmail` method, despite it appearing in older documentation and LLM training data.

Available admin methods in v2 (as of 2.106.x):
- `listUsers(params?: { page, perPage })` — paginated, no server-side email filter
- `getUserById(uid: string)`
- `createUser(attributes)`
- `updateUserById(uid, attributes)`
- `deleteUser(id)`
- `inviteUserByEmail(email, options?)`
- `generateLink(params)`
- `signOut(jwt, scope?)`

**To check user existence by email**: use `listUsers` and filter client-side. Page through with `perPage: 1000` until match found or list exhausted. For small apps (quiniela groups) this is acceptable — first page almost always suffices.

**Why:** TypeScript compilation fails with `Property 'getUserByEmail' does not exist on type 'GoTrueAdminApi'`. The method simply doesn't exist.
**How to apply:** Never use `getUserByEmail` — always use `listUsers` + `.find()` / `.some()` filtering by `u.email?.toLowerCase()`.
