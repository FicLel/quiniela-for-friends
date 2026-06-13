# Technical Brief: Admin Read-Only Impersonation ("View as User")

**Story**: As an admin, I can enter a user's email to view the app exactly as they see it (predictions/leaderboard) in a strictly read-only session, with an always-visible "Viewing as {email}" banner and exit control.
**Date**: 2026-06-12
**Status**: Draft

---

## Open Decisions — Resolved

### Decision 1: Global write-block guard vs. per-route checks

**Resolution: Per-handler check via a shared session helper, NOT a `proxy.ts`-based global guard.**

`proxy.ts` (project root) has matcher:
```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```
This **excludes all `/api/*` routes** from the proxy entirely. Since several mutation entry points are `/api/...` route handlers (e.g. `app/api/quinielas/[quinielaId]/extra-questions/...`), a proxy-based guard cannot intercept them — it would only cover Server Actions reached via page navigation, leaving API mutation routes unprotected. A proxy-based guard is therefore insufficient as the *sole* mechanism.

Additionally, every existing mutation entry point (Server Actions in `app/[lang]/(private)/**/actions.ts`, and API routes under `app/api/**/route.ts`) already independently derives its session via:
```ts
const authClient = new AuthClient()
const token = await authClient.getTokenFromServerAction()
const session = token ? await authClient.verifyToken(token) : null
```
This is the existing chokepoint pattern — there is no shared middleware for mutations today, by design (per `docs/architecture.md`, Services depend on session as a plain value, not on Next.js).

**Chosen approach**: Extend `SessionPayload` (in `auth/AuthClient.ts`) with an optional `impersonating` field. Add one new shared helper, `AuthClient.assertNotImpersonating(session)` (or a small new module `auth/impersonationGuard.ts` exporting `requireWritableSession(session)`), that every mutation-capable Server Action / API route calls immediately after resolving its session — returning the existing `{ success: false, error: 'UNKNOWN_ERROR' }` / `403` shape used elsewhere when `session.impersonating` is set. This keeps the existing "auth-check first" pattern (see `[[server-action-patterns]]`) and requires a small, mechanical addition to each mutation handler rather than inventing new infrastructure.

As **defense in depth** (not the primary guard), `proxy.ts` can also redirect away from any obviously-mutation-only page route if `session.impersonating` is set — but this is optional polish, not the AC-8 enforcement mechanism.

⚠️ This requires touching every existing mutation Server Action / API route (see Section 7) to add the one-line guard call. This is a deliberate, mechanical, low-risk change consistent with the existing per-handler auth pattern — NOT a new architectural layer.

### Decision 2: TtlCache key shape for impersonated reads

**Resolution: New dedicated `TtlCache` instance, NOT an extension of an existing cache.**

Current state of `lib/ttlCache.ts`: a generic `TtlCache<V>` class (TTL + LRU eviction via `maxEntries`). It is currently used only by:
- `competitions/CompetitionsRepository.ts` — `matchesCache = new TtlCache<Match[]>(30_000, 1)` (single global entry — all matches)
- `appSettings/AppSettingsRepository.ts` — `settingsCache = new TtlCache<AppSettings | null>(60_000, 1)` (single global entry — app settings)

**`scoring/LeaderboardService.ts` and `scoring/PredictionScoreRepository.ts` currently have NO `TtlCache` usage** — `getPlayerPredictions` / `findPlayerPredictionsForViewer` hit Supabase directly on every call. There is no existing per-quiniela or per-user cache instance to "extend" — both existing caches are singleton (`maxEntries: 1`, one global key), which is the wrong shape for per-user data and must not be reused.

**Chosen approach**: Add a new module-level cache in `scoring/PredictionScoreRepository.ts` (or a new `scoring/playerPredictionsCache.ts` following the `usersCache.ts` / dedicated-cache-module convention):
```ts
const playerPredictionsCache = new TtlCache<PlayerPredictionEntry[]>(30_000, 200)
```
- **Cache key**: `` `${quinielaId}:${viewerUserId}` `` — `viewerUserId` is *always* the impersonated user's ID when impersonating, and the admin's own `session.sub` otherwise. Because the key is keyed by the **subject whose data is being read** (not the caller), admin-own-reads and impersonated-reads naturally land in different keys with zero special-casing — there is no "admin cache" vs. "impersonation cache" distinction needed. This directly satisfies AC-9 (impersonated reads are cached and reused within TTL) and AC-10 (no leakage: a regular session for user A and an impersonated session for user A use the *same* key `quinielaId:A`, which is correct — that data belongs to user A regardless of who is viewing it as read-only).
- `findPlayerPredictionsForViewer(quinielaId, userId)` checks `playerPredictionsCache.get(`${quinielaId}:${userId}`)` before querying Supabase, and `.set(...)` after.
- **Invalidation**: the existing write path that changes a user's predictions/scores (`upsertBatch` in `PredictionScoreRepository`, called from `ScoringService` after `syncMatchResult`) must call `playerPredictionsCache.invalidate(`${quinielaId}:${userId}`)` for affected users — otherwise stale predictions could be served after a manual recalculation (AC for "manual point calculation after matches" per recent commit `73ece06`). This is a new invalidation call alongside existing writes.
- AC-10's "session ended" cache concern: since the key is per-(quiniela, subject-user) and never per-(admin-session), ending an impersonation session does not require any cache eviction — there is nothing keyed by the admin's transient impersonation state to clean up.

⚠️ This is a **new cache instance**, justified because the two existing instances are intentionally singleton/global-scope caches (`maxEntries: 1`) and unsuitable for per-(quiniela, user) data. `maxEntries: 200` is a starting estimate (covers ~200 concurrently-active quiniela/user pairs); tune based on observed traffic.

### Decision 3: "Viewing as {email}" banner placement

**Resolution: `app/[lang]/(private)/layout.tsx`.**

This is the single shared layout for ALL private routes — it already:
1. Resolves the session server-side (`AuthClient.getTokenFromServerAction()` → `verifyToken()`).
2. Redirects to login if no session.
3. Renders `<Navbar lang={lang} dict={...} isAdmin={isAdmin} quinielas={quinielas} />` once, above `{children}`.

Adding impersonation resolution here guarantees the banner renders on **every** private page (welcome, leaderboard, members, admin settings, etc.) with **one** change, satisfying AC-6 without per-page additions. The banner component (`ImpersonationBanner`, new) is rendered as a sibling of `<Navbar>`, between it and `{children}`, so it is visible immediately below the nav on every page — including after full reload / new tab (AC: "Browser refresh / new tab during impersonation"), because the layout re-resolves session server-side on every request.

---

## 1. Data Model Changes

**No new tables.** Impersonation session state is carried entirely in the existing signed session cookie (JWT), extending `SessionPayload`.

### `auth/AuthClient.ts` — extend `SessionPayload`

```ts
export type SessionPayload = {
  sub: string
  email: string
  role: 'admin' | 'player'
  mustChangePassword: boolean
  tokenVersion: number
  impersonating?: {
    userId: string   // impersonated user's id (= effective "viewing as" subject)
    email: string    // impersonated user's email, for the banner
  }
}
```

- `sub` / `email` / `role` / `tokenVersion` continue to represent the **real, authenticated admin** — they are never overwritten. This preserves `app/[lang]/(private)/layout.tsx`'s existing token-version freshness check (`freshUser.tokenVersion !== session.tokenVersion`), which must keep validating against the real admin's row in `public.users`.
- `impersonating` is `undefined` for normal sessions (back-compatible — `verifyToken` already does `(payload['tokenVersion'] as number) ?? 1`-style optional fallbacks).
- A new helper on `AuthClient`, `getEffectiveUserId(session)`, returns `session.impersonating?.userId ?? session.sub` — this is the single place that "which user's data are we reading" is computed, used by every read path touched in Section 2.

⚠️ **Tenant isolation**: Impersonation must NOT bypass `quiniela_memberships`-based scoping. AC-5 explicitly requires `membershipsRepo.isApprovedMember(quinielaId, effectiveUserId)` to be evaluated against the **impersonated** user's ID — i.e., impersonation must flow through the *exact same* quiniela-membership gates as a real session for that user (per `[[tenant-isolation]]`: `quiniela_id`-scoped repository checks are the real guard). No new bypass path is introduced.

### Migration

None required. State is JWT-cookie-only, consistent with the existing `auth` module (no server-side session table exists today).

---

## 2. Background / Process Flow

### Flow A — Start impersonation (AC-1, 2, 3, 11, 12, 13)

1. **View**: Admin navigates to new entry screen `app/[lang]/(private)/admin/impersonate/page.tsx`, submits email via a form bound to a new Server Action.
2. **Server Action** `app/[lang]/(private)/admin/impersonate/actions.ts` → `startImpersonation(email: string)`:
   - Resolve real session via `AuthClient.getTokenFromServerAction()` / `verifyToken()` (existing pattern).
   - **AC-3**: if `session.role !== 'admin'` (global app-role gate per `[[quiniela-admin-role]]`), return `{ success: false, error: 'NOT_ADMIN' }`.
   - Normalize email: `email.trim().toLowerCase()` (AC: "Email casing/whitespace — normalize before `findByEmail`").
   - **Application layer**: new `ImpersonationService.start(adminSession, normalizedEmail)` in a new module `impersonation/ImpersonationService.ts`, depending on `IUsersRepository` (port).
     - `UsersRepository.findByEmail(normalizedEmail)` (existing method, `users/UsersRepository.ts:75`).
     - **AC-2**: if `null` → `{ success: false, error: 'USER_NOT_FOUND' }`.
     - **AC-11**: if `target.role === 'admin'` and `target.id !== session.sub` → `{ success: false, error: 'CANNOT_IMPERSONATE_ADMIN' }`.
     - **AC-12**: if `target.id === session.sub` (self) → proceed, producing `impersonating: { userId: session.sub, email: session.email }` (harmless no-op banner "Viewing as {own email}").
     - **AC-13**: if `session.impersonating` is already set (switching targets) → no extra step needed; the new token simply overwrites `impersonating` — "silently end A, start B" falls out of JWT replacement.
   - On success: `AuthClient.createToken({ ...session, impersonating: { userId: target.id, email: target.email } })` → `setSessionCookieOnServerAction(newToken)`.
   - `redirect('/${lang}/welcome')` (placed AFTER the try/catch, per `[[server-action-patterns]]`).

3. **Domain/Application layer**: `ImpersonationService` is pure business logic — no Supabase/Next imports, depends only on `IUsersRepository` port (matches `docs/architecture.md` Services layer).
4. **Infrastructure layer**: `UsersRepository.findByEmail` (existing, no change needed).

### Flow B — Reading data while impersonating (AC-4, 5, 9, 10)

1. **View** (Server Component, e.g. `app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/page.tsx`):
   - Resolve session as today.
   - Compute `const effectiveUserId = authClient.getEffectiveUserId(session)` (new helper, Section 1).
   - **AC-5**: `membershipsRepository.isApprovedMember(quinielaId, effectiveUserId)` — replace the current `session.sub` argument with `effectiveUserId`. If `false`, `redirect` exactly as today (same denial path the impersonated user themselves would hit).
   - **AC-4**: `leaderboardService.getPlayerPredictions(quinielaId, effectiveUserId)` — replace `session.sub` with `effectiveUserId` wherever the *viewer's own* predictions are fetched.
2. **Application layer**: `LeaderboardService.getPlayerPredictions(quinielaId, userId)` — **no change**, already takes `userId` as a parameter (`scoring/LeaderboardService.ts:114`); callers now pass `effectiveUserId`.
3. **Infrastructure layer**: `PredictionScoreRepository.findPlayerPredictionsForViewer(quinielaId, userId)`:
   - **AC-9**: check `playerPredictionsCache.get(`${quinielaId}:${userId}`)` first; on miss, run existing two-step Supabase query, then `playerPredictionsCache.set(...)`.
4. **API route** `app/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts` (this route lets ANY approved member view ANY OTHER member's predictions — the `[userId]` path param is the *target*, distinct from the *caller*):
   - Current line 48: `membershipsRepo.isApprovedMember(quinielaId, session.sub)` checks the **caller's** membership. Under impersonation, this must become `isApprovedMember(quinielaId, effectiveUserId)` so the impersonated user's own membership (not the admin's) gates access — consistent with AC-5.
   - The `userId` route param (whose predictions to fetch) is unaffected — it is already an explicit target, separate from the caller.

### Flow C — Exit impersonation (AC-7)

1. **View**: `ImpersonationBanner` (in `app/[lang]/(private)/layout.tsx`) renders an exit button/link, a Server Action `endImpersonation()` in `app/[lang]/(private)/admin/impersonate/actions.ts`.
2. **Server Action**: resolve session; if `session.impersonating` set, `AuthClient.createToken({ ...session, impersonating: undefined })` → `setSessionCookieOnServerAction(newToken)` → `redirect('/${lang}/admin/impersonate')` (back to entry screen / admin's own view).
3. No DB writes — purely a cookie/token replacement.

### Flow D — Blocking writes while impersonating (AC-8)

1. Every mutation Server Action / API route, immediately after resolving `session`, calls `requireWritableSession(session)` (new helper — see Decision 1). If `session.impersonating` is set (and not self-impersonation, where it's harmless — see note below), return the handler's existing error shape (`{ success: false, error: 'IMPERSONATING_READ_ONLY' }` or `403` for API routes) **before** any repository/service call.
2. **Self-impersonation (AC-12) edge case**: when `impersonating.userId === session.sub`, the admin is "viewing as themselves" — per AC-12 this "may proceed and display the admin's own data" but the story does not require write-blocking to relax in this case. To keep the guard simple and the read-only guarantee absolute, `requireWritableSession` blocks writes whenever `session.impersonating` is set at all, **including self-impersonation** — the admin must `endImpersonation()` to regain write access. This is the simplest, most predictable rule and avoids a special-cased "except when impersonating self" branch that would be easy to get wrong. ⚠️ Flag this for human confirmation — if Victor prefers self-impersonation to retain write access, `requireWritableSession` would instead check `impersonating.userId !== session.sub`.

---

## 3. API Changes

### Modified: `app/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts`

- Line 48: change `membershipsRepo.isApprovedMember(quinielaId, session.sub)` → `membershipsRepo.isApprovedMember(quinielaId, authClient.getEffectiveUserId(session))`.
- No request/response shape changes.

### New (Server Actions, not REST routes — per `[[server-action-patterns]]`)

`app/[lang]/(private)/admin/impersonate/actions.ts`:

```ts
'use server'

export async function startImpersonation(
  email: string,
): Promise<
  | { success: true }
  | { success: false; error: 'NOT_ADMIN' | 'USER_NOT_FOUND' | 'CANNOT_IMPERSONATE_ADMIN' | 'UNKNOWN_ERROR' }
>

export async function endImpersonation(): Promise<{ success: true } | { success: false; error: 'UNKNOWN_ERROR' }>
```

Both follow the existing pattern: resolve session → validate → call `ImpersonationService` → on success, set cookie + `redirect()` placed after the try/catch.

### Modified mutation entry points (write-block guard, AC-8)

Every existing mutation Server Action / API route gets one added guard line after session resolution. Full list in Section 7. Representative examples:
- `app/[lang]/(private)/welcome/actions.ts` → `saveExpectedResult`
- `app/[lang]/(private)/dashboard/actions.ts` → `approveMember`
- `app/[lang]/(private)/quinielas/[quinielaId]/members/actions.ts` (remove/leave member mutations)
- `app/[lang]/(private)/quinielas/new/actions.ts` (create quiniela)
- `app/api/quinielas/[quinielaId]/extra-questions/**/route.ts` (POST/PUT handlers)
- `app/api/admin/**/route.ts` (admin sync/save routes — these are already admin-gated by `session.role`, but must additionally reject if `session.impersonating` is set, since an impersonating admin's `session.role` is still `'admin'`)

---

## 4. Frontend Changes

### New: `app/[lang]/(private)/admin/impersonate/page.tsx`

- Server Component. Resolves session; if `session.role !== 'admin'` (AC-3), `redirect()` to `/${lang}/welcome` (consistent with how other admin-only pages reject non-admins, e.g. `dashboard/page.tsx` pattern — verify exact redirect target during implementation).
- Renders a form (email input + submit) bound to `startImpersonation` Server Action, plus an "Exit impersonation" button bound to `endImpersonation` if `session.impersonating` is already set.

### New: `app/[lang]/(private)/admin/impersonate/_components/ImpersonationEntryForm.tsx`

- Client Component (`'use client'`) — controlled input, calls `startImpersonation(email)`, displays `USER_NOT_FOUND` / `CANNOT_IMPERSONATE_ADMIN` / `NOT_ADMIN` errors via dictionary strings (discriminated-union error handling per `[[server-action-patterns]]`).

### New: `app/_components/ImpersonationBanner.tsx`

- Server Component (no client state needed — renders from `session.impersonating` resolved in the layout).
- Props: `{ lang: Locale; email: string; dict: Dictionary['impersonation'] }`.
- Renders a full-width, visually distinct (e.g. `bg-amber-500` / `bg-yellow-400`, high-contrast) bar: `"Viewing as {email}"` + an exit link/button. The exit control can be a `<form action={endImpersonation}>` with a submit button, or a `Link` to `/admin/impersonate` if exit requires a confirmation step — a plain form-submit is simplest and consistent with other Server-Action-bound buttons in the codebase.

### Modified: `app/[lang]/(private)/layout.tsx`

- After resolving `session` (existing code at lines 22–23), compute `const impersonating = session.impersonating`.
- Render `<ImpersonationBanner lang={lang} email={impersonating.email} dict={dict.impersonation} />` conditionally, between `<Navbar .../>` and `{children}`:

```tsx
return (
  <>
    <Navbar lang={lang as Locale} dict={dict.navbar} isAdmin={isAdmin} quinielas={quinielas} />
    {session.impersonating && (
      <ImpersonationBanner lang={lang as Locale} email={session.impersonating.email} dict={dict.impersonation} />
    )}
    {children}
  </>
)
```

- ⚠️ `isAdmin` is currently derived from `freshUser.role === 'admin'` (the **real** admin's role, from `usersRepo.findById(session.sub)` — `session.sub` is never overwritten, so this remains correct and continues to show admin nav links to the impersonating admin, which is desirable — the admin needs to reach `/admin/impersonate` to exit).

### Modified: `app/_components/Navbar.tsx`

- No change required — `isAdmin` continues to reflect the real admin's role (see above), so admin nav links remain visible during impersonation, allowing the admin to navigate back to `/admin/impersonate` to exit.

### i18n additions

`i18n/dictionaries/en.json` and `i18n/dictionaries/es.json` — new `impersonation` dictionary key:
```json
"impersonation": {
  "viewingAs": "Viewing as {email}",
  "exit": "Exit",
  "entryTitle": "View as user",
  "emailLabel": "User email",
  "submit": "Start viewing",
  "errorNotAdmin": "...",
  "errorUserNotFound": "No user found with that email.",
  "errorCannotImpersonateAdmin": "Cannot view as another admin.",
  "errorUnknown": "Something went wrong."
}
```
Add `impersonation` to `Dictionary` type in `i18n/i18n.types.ts` (or wherever `Dictionary` is declared — verify exact location, likely `i18n/getDictionary.ts`).

### New Tailwind patterns

None — reuse existing color palette (`green-*` for normal nav, a contrasting `amber`/`yellow` for the banner is a new but minor addition, no new utilities or libraries).

---

## 5. Tests Required

Per `docs/testing.md`: unit tests for services/domain logic (mocked ports), integration tests for repositories/auth, scenario-style naming.

### Unit tests — `impersonation/__tests__/ImpersonationService.test.ts` (new)

**Success cases:**
- `start()` with a valid, non-admin target email returns success and the impersonation payload `{ userId, email }` (AC-1).
- `start()` with the admin's own email returns success with `impersonating.userId === session.sub` (AC-12, self-impersonation no-op).
- `start()` while already impersonating User A, targeting User B, returns success with `impersonating` now pointing at B (AC-13 — "switch silently").

**Failure cases:**
- `start()` with `session.role !== 'admin'` returns `NOT_ADMIN` without calling `findByEmail` (AC-3).
- `start()` with an email not found via `UsersRepository.findByEmail` returns `USER_NOT_FOUND` (AC-2).
- `start()` targeting another user with `role === 'admin'` returns `CANNOT_IMPERSONATE_ADMIN` (AC-11).

**Edge cases:**
- Email normalization: `start('  Foo@Bar.COM ')` calls `findByEmail('foo@bar.com')` (AC: casing/whitespace).

### Unit tests — `auth/__tests__/AuthClient.test.ts` (extend existing or new)

- `getEffectiveUserId(session)` returns `session.impersonating.userId` when set, else `session.sub`.
- `verifyToken` round-trips a payload containing `impersonating`, and also correctly returns `impersonating: undefined` for tokens issued before this change (back-compat — old tokens lack the field).
- New `requireWritableSession(session)` (or equivalent guard): returns blocked when `session.impersonating` is set (including self-impersonation per the Section 2 Flow D resolution); returns allowed when `session.impersonating` is `undefined`.

### Unit tests — `scoring/__tests__/LeaderboardService.test.ts` (extend existing, in-progress file)

- `getPlayerPredictions(quinielaId, effectiveUserId)` — confirm it is called with the **impersonated** user's ID, not the admin's `session.sub`, when the caller passes `effectiveUserId` (this is exercised at the route/page level — the service itself is already a thin delegate per the existing test at line 338, so no new service-level test is strictly needed beyond confirming the delegate signature is unchanged).

### Unit tests — `scoring/__tests__/PredictionScoreRepository.test.ts` (new, or extend if integration-style tests exist)

**Success cases:**
- `findPlayerPredictionsForViewer(quinielaId, userId)` — first call misses `playerPredictionsCache`, queries Supabase, populates cache.
- Second identical call within TTL returns from cache without a second Supabase query (AC-9) — mock Supabase client call count.

**Edge cases:**
- Cache key isolation: `playerPredictionsCache` entries for `quinielaId:userA` and `quinielaId:userB` are independent — populating one does not affect the other (AC-10, no cross-user leakage).
- `upsertBatch` (or the calling `ScoringService.syncMatchResult` path) invalidates `playerPredictionsCache` for affected `(quinielaId, userId)` pairs — a stale cached read is not returned after a score recalculation.
- Impersonated user has no predictions yet → `findPlayerPredictionsForViewer` returns `[]`, not an error (existing test at line 351 already covers the empty-array contract; reuse).

### Integration tests — API route `app/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts`

**Success cases:**
- Admin impersonating an approved member of `quinielaId` → 200 with that member's predictions (AC-4).

**Failure cases:**
- Admin impersonating a user who is NOT an approved member of `quinielaId` → 403 (AC-5), same response shape as a non-member's own request would get.
- Non-admin attempting to call `startImpersonation` (via Server Action invocation in a test harness) → `NOT_ADMIN` (AC-3).

### Component tests — `app/_components/__tests__/ImpersonationBanner.test.tsx` (new)

- Renders `"Viewing as {email}"` with the correct email when `session.impersonating` is set.
- Renders an exit control that, when activated, calls `endImpersonation`.
- Not rendered at all when `session.impersonating` is `undefined`.

### Component tests — `app/[lang]/(private)/admin/impersonate/_components/__tests__/ImpersonationEntryForm.test.tsx` (new)

- Submitting a valid email calls `startImpersonation` and (on success) the page redirects (mock `next/navigation` redirect, consistent with other action-bound form tests in this codebase).
- `USER_NOT_FOUND` / `CANNOT_IMPERSONATE_ADMIN` / `NOT_ADMIN` errors render the corresponding dictionary strings.

### E2E / scenario coverage (per `docs/testing.md` SDD style — describe near code if no e2e runner configured)

- "Given an admin starts impersonating User A who has predictions in Quiniela X, when the admin opens Quiniela X's leaderboard and views User A's predictions modal, then User A's actual predictions are shown" (AC-4).
- "Given an admin is impersonating, when they attempt `saveExpectedResult`, then no row is written to `user_expected_results` and an error is returned" (AC-8) — verify via repository call assertion (not invoked) in a mocked test, since no e2e runner exists yet.
- "Given an admin ends impersonation, when a regular user (not impersonated) requests their own predictions for the same quiniela immediately after, then they receive their own data, not the previously-impersonated user's cached data" (AC-10) — covered by the cache-key-isolation test above (different keys by construction).
- "Given an admin's session expires mid-impersonation (token expiry), when any page is requested, then the proxy redirects to `/login` exactly as for a non-impersonating expired session" — covered implicitly since `impersonating` lives inside the same JWT that expires; no special-case needed, but worth a regression test on `proxy.ts` to confirm an expired token with `impersonating` set still redirects to login.

---

## 6. Risks and Open Questions

1. **Self-impersonation write-block (Section 2, Flow D)**: The brief resolves this as "blocks writes always when `impersonating` is set, including self," for simplicity and an absolute read-only guarantee. AC-12 says self-impersonation "may proceed and display the admin's own data" but does not explicitly require writes to remain enabled. **Needs confirmation from Victor** before implementation — if writes should remain enabled for self-impersonation, `requireWritableSession` needs an `impersonating.userId !== session.sub` condition, and the AC-8 test matrix must add a "self-impersonation + write succeeds" case.

2. **Mechanical scope of Section 1/Decision 1**: Adding the write-guard to every existing mutation handler touches a non-trivial number of files (Section 7 lists ~6+ Server Action files and several API routes). This is intentionally mechanical/low-risk but is the largest part of the diff by file count. Recommend the-backend agent grep for all `'use server'` files and all `route.ts` files under `app/api/` with `POST`/`PUT`/`DELETE`/`PATCH` exports to build a complete checklist — Section 7's list should be treated as a starting point, not exhaustive.

3. **`playerPredictionsCache` TTL value (30s, matching `matchesCache`)**: chosen by analogy to `competitions/CompetitionsRepository.ts`'s existing 30s TTL. If predictions feel stale to admins debugging "my picks didn't save" (the primary use case!), a shorter TTL (e.g. 5–10s) or cache bypass specifically for impersonated reads may be preferable — debugging a "didn't save" report with a 30s-stale cache could itself look like a bug. **Recommend**: either a shorter TTL for this cache than `matchesCache`, or skip the cache entirely for impersonated reads (cache only the admin's-own-view path). Flagging for discussion — the AC only requires that *a* cache exists and is reused (AC-9), it doesn't mandate impersonated reads specifically be cached if that conflicts with the debugging use case.

4. **Tenant isolation**: No new isolation risk identified — Section 2 Flow B explicitly routes impersonated reads through the same `quiniela_id`-scoped `isApprovedMember` / `findPlayerPredictionsForViewer` calls that gate a real user's own session, per `[[tenant-isolation]]`. The only structural change is *which user ID* is passed into already-scoped queries, derived from a single new `getEffectiveUserId()` helper — centralizing this avoids the risk of some call sites using `session.sub` and others using `effectiveUserId` inconsistently. ⚠️ **Backend builder must grep for all call sites currently passing `session.sub` into membership/prediction reads** (not just the two cited in AC-4/5) and audit each for whether it represents "the viewer's own data" (→ should become `effectiveUserId`) vs. "an action attributable to the real admin" (→ stays `session.sub`, e.g. audit/logging if any exists — none currently does).

5. **Timezone handling**: This feature introduces no new dates, deadlines, or scheduled events — `PlayerPredictionEntry.scheduledAt` (ISO string from `matches.scheduled_at`, a `TIMESTAMPTZ` column per `[[repository-patterns]]`) is read-only and unchanged by this feature. No timezone-specific logic is required.

6. ⚠️ **No new dependencies, no new database, no new scheduler** — confirmed. This feature is implementable entirely within the existing `auth`, `scoring`, `memberships`, `users` modules plus one new `impersonation` module, the existing JWT cookie, and the existing `TtlCache` class (new instance, not new infrastructure).

7. **Banner exit-control UX**: Section 4 proposes a simple `<form action={endImpersonation}>` button. If the design calls for a more prominent fixed/sticky banner or confirmation modal, that's a `ui-ux-layout-strategist` / `component-api-architect` decision, out of scope for this brief — flagging so frontend builder doesn't over-invest in styling before a design pass if one is desired.

8. **`Dictionary` type location**: Section 4 assumes `i18n/i18n.types.ts` or `i18n/getDictionary.ts` defines the `Dictionary` type that needs a new `impersonation` key — exact file should be confirmed by the-frontend during implementation (not independently verified in this brief beyond confirming both dictionary JSON files exist at `i18n/dictionaries/{en,es}.json`).

---

## 7. Files That Will Change

### Data
- None (no migrations).

### API / Backend
- `auth/AuthClient.ts` — extend `SessionPayload` with optional `impersonating: { userId: string; email: string }`; add `getEffectiveUserId(session)` and `requireWritableSession(session)` (or equivalent guard) helpers.
- **NEW** `impersonation/ImpersonationService.ts` — `start(adminSession, email)` / no-op `end` (end is just cookie replacement, may not need service logic).
- **NEW** `impersonation/impersonation.types.ts` — result types (`StartImpersonationResult`, etc.) and `IImpersonationService` port if a port interface is warranted (likely thin enough that direct class use is fine, per existing service patterns — confirm with `[[arch-patterns]]` during implementation).
- **NEW** `app/[lang]/(private)/admin/impersonate/actions.ts` — `startImpersonation(email)`, `endImpersonation()`.
- `scoring/PredictionScoreRepository.ts` — add `playerPredictionsCache` (`TtlCache<PlayerPredictionEntry[]>`), wire into `findPlayerPredictionsForViewer`; add cache invalidation call in `upsertBatch` (or wherever scores are recalculated, e.g. `ScoringService`).
- `app/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts` — change `isApprovedMember(quinielaId, session.sub)` → `isApprovedMember(quinielaId, effectiveUserId)`.
- Pages performing the impersonated read (at minimum): `app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/page.tsx` — replace `session.sub` with `effectiveUserId` in the `isApprovedMember` check (and anywhere else `session.sub` represents "the viewer").
- **Write-block guard additions** (Decision 1, AC-8) — add `requireWritableSession(session)` call after session resolution in:
  - `app/[lang]/(private)/welcome/actions.ts` (`saveExpectedResult`, and any other mutating actions in this file)
  - `app/[lang]/(private)/dashboard/actions.ts` (`approveMember`, and other mutating actions)
  - `app/[lang]/(private)/quinielas/new/actions.ts`
  - `app/[lang]/(private)/quinielas/[quinielaId]/members/actions.ts`
  - `app/[lang]/(private)/auth/change-password/actions.ts`
  - `app/api/admin/matches/sync/route.ts`, `app/api/admin/players/save-team/route.ts`, `app/api/admin/players/sync/{start,finish,item-error}/route.ts`, `app/api/admin/players/team-detail/route.ts`, `app/api/admin/settings/route.ts` (POST/PUT handlers)
  - `app/api/quinielas/[quinielaId]/extra-questions/**/route.ts` (POST/PUT/resolve handlers)
  - ⚠️ This list is a starting point — backend builder must grep for all `'use server'` files and all `route.ts` POST/PUT/PATCH/DELETE exports to confirm completeness (Risk #2).

### Frontend
- `app/[lang]/(private)/layout.tsx` — resolve `session.impersonating`, conditionally render `<ImpersonationBanner>`.
- **NEW** `app/_components/ImpersonationBanner.tsx`.
- **NEW** `app/[lang]/(private)/admin/impersonate/page.tsx`.
- **NEW** `app/[lang]/(private)/admin/impersonate/_components/ImpersonationEntryForm.tsx`.
- `i18n/dictionaries/en.json`, `i18n/dictionaries/es.json` — add `impersonation` dictionary section.
- `i18n/i18n.types.ts` (or wherever `Dictionary` type is declared) — add `impersonation` key to `Dictionary` type.

### Tests
- **NEW** `impersonation/__tests__/ImpersonationService.test.ts`
- **NEW or extend** `auth/__tests__/AuthClient.test.ts`
- **NEW** `scoring/__tests__/PredictionScoreRepository.test.ts` (cache behavior)
- `scoring/__tests__/LeaderboardService.test.ts` — confirm existing delegate tests still pass unchanged (no new tests strictly required at this layer)
- **NEW** `app/_components/__tests__/ImpersonationBanner.test.tsx`
- **NEW** `app/[lang]/(private)/admin/impersonate/_components/__tests__/ImpersonationEntryForm.test.tsx`
- Integration test additions for `app/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts` (if an existing test file covers this route — locate during implementation; none found in current exploration).

### Config
- None.
