---
name: feedback-authclient-admin
description: AuthClient should NOT eagerly load SUPABASE_SERVICE_ROLE_KEY — remove adminClient until actually needed, then use lazy-init getter
metadata:
  type: feedback
---

Do not instantiate an admin/service-role Supabase client in the AuthClient constructor unless a method on AuthClient actually calls it.

**Why:** Eagerly requiring SUPABASE_SERVICE_ROLE_KEY on every AuthClient instantiation crashes the process if the env var is missing, even in contexts that never need admin access. It also obscures which operations actually require elevated privileges.

**How to apply:** When adding admin operations to AuthClient (e.g. creating users via Supabase Admin API), use a private lazy getter:
```typescript
private _adminClient: SupabaseClient | null = null
private get adminClient(): SupabaseClient {
  if (!this._adminClient) {
    this._adminClient = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
  }
  return this._adminClient
}
```
Until that point, keep SUPABASE_SERVICE_ROLE_KEY documented in .env.example (with a note that it's for future admin use) but do not call requireEnv for it in the constructor.
