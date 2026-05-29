---
name: project-password-auth
description: Custom JWT auth replaces Supabase Auth; bcrypt hashes stored in public.users; session in HttpOnly cookie
metadata:
  type: project
---

Email + Password auth uses a fully custom JWT + bcrypt stack (no Supabase Auth as IdP). Key facts as of 2026-05-27:

## Auth stack
- **jose** (HS256 JWT): `AuthClient.createToken()` / `verifyToken()`
- **bcryptjs** (cost 12): `AuthService.login()` / `changePassword()` — bcrypt imported directly in AuthService, not in AuthClient
- Session stored in an HttpOnly cookie named `session` (7-day expiry)
- `SESSION_SECRET` env var (min 32 chars) required — added to `.env.example`

## public.users schema (after migration 20260527000000_custom_auth.sql)
- `id` UUID PK
- `email` TEXT UNIQUE NOT NULL
- `password_hash` TEXT NOT NULL  ← bcrypt hash
- `role` TEXT ('admin' | 'player')
- `must_change_password` BOOLEAN
- `created_at`, `updated_at` TIMESTAMPTZ
- No `auth_id` column (dropped in this migration — was a FK to Supabase auth.users)

## IUsersRepository interface
- `findById(id)` / `findByEmail(email)` / `setMustChangePassword(userId, value)` / `setPasswordHash(userId, hash)`
- Note: `setMustChangePassword` and `setPasswordHash` use `.eq('id', userId)` — not `auth_id`

## AuthService.login(email, password) → LoginResult
- Result shape: `{ success: true, token, mustChangePassword }` or `{ success: false, error }`
- No SupabaseClient parameter — all Supabase access is via repository only

## AuthService.changePassword(userId, newPassword) → ChangePasswordResult
- Result shape: `{ success: true, token }` or `{ success: false, error }`
- Issues a fresh token after password change (mustChangePassword: false)

## proxy.ts
- Reads `session` cookie via `AuthClient.getTokenFromRequest(request)`
- No UsersRepository call — mustChangePassword is embedded in the JWT payload
- No Supabase SDK imports

## Server Actions
- `app/(public)/login/actions.ts`: calls `authClient.setSessionCookieOnServerAction(token)` after login
- `app/(private)/auth/change-password/actions.ts`: reads session via `authClient.getTokenFromServerAction()`, then sets refreshed cookie after change

**Why:** Supabase Auth replaced with custom JWT for full control over session management and to eliminate the Supabase Auth dependency.

**How to apply:** When building new features that need the current user, read the `session` cookie via AuthClient.verifyToken() — the payload has `sub` (userId), `email`, `role`, `mustChangePassword`. [[nextjs16-changes]]
