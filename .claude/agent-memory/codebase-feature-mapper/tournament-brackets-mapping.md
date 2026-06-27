---
name: tournament-brackets-feature-map
description: Complete codebase mapping for Tournament Brackets feature request (bracket visualization, group standings, quiniela switcher, mobile-first design)
metadata:
  type: reference
---

## Feature Request Summary

The "Tournament Brackets" feature request asks for:
1. A new screen showing the full tournament bracket structure (Round of 32 through Final)
2. Per-quiniela scoping: each quiniela the user belongs to has its own bracket view
3. Quiniela switcher/rotator on the bracket screen to change between user's quinielas
4. Automatic bracket updates as match scores/results come in
5. Group-stage projected standings based on current group stats (not just locked results)
6. Two layers of info per matchup: (a) user's prediction, (b) actual result
7. External sports data API integration (football-data.org identified)
8. Local caching until next update, with predictions merged into cache
9. Mobile-first experience

**Status**: Feature does NOT exist; foundational infrastructure IS in place.

---

## Domain Model: Quinielas & Membership

**File**: `quinielas/quinielas.types.ts`
- `Quiniela` type: `{ id, name, createdAt, updatedAt }`
- Service: `IQuinielasService.listQuinielasForUser(userId) → Promise<ListQuinielasForUserResult>`
- Repository: `IQuinielasRepository.findAllForUser(userId) → Promise<Quiniela[]>`

**File**: `memberships/memberships.types.ts`
- `Membership` type: `{ id, quinielaId, userId, role ('admin'|'member'), joinedAt, approvedAt }`
- Key methods:
  - `isApprovedMember(quinielaId, userId) → Promise<boolean>` — enforces access control
  - `findAllByQuiniela(quinielaId) → Promise<MemberWithUser[]>` — list members of a quiniela
  - `countByUser(userId) → Promise<number>` — count approved quinielas for user

**User-Quiniela access pattern**:
1. User calls `QuinielasService.listQuinielasForUser(userId)` to get all quinielas.
2. When viewing bracket for a specific quiniela, `MembershipsRepository.isApprovedMember(quinielaId, userId)` gates access.
3. Example: `leaderboard/page.tsx` lines 35–39.

---

## Tournament/Match Data Model

**File**: `competitions/competitions.types.ts`

### Match Type (Lines 11–36)
```typescript
export type Match = {
  id: string                     // UUID
  externalId: number | null      // from football-data.org
  stage: string                  // "GROUP_STAGE", "ROUND_OF_32", etc.
  group: string                  // "A", "B", ..., "" for knockout
  matchday: number
  status: string                 // "FINISHED", "SCHEDULED", "IN_PLAY"
  scheduledAt: Date
  homeTeamName: string
  homeTeamShortName: string
  homeTeamTla: string            // 3-letter code
  homeTeamCrest: string | null   // team logo
  awayTeamName: string
  awayTeamShortName: string
  awayTeamTla: string
  awayTeamCrest: string | null
  bracketSlot: string | null     // "R32_01", "R16_01", "FINAL_01" (knockout only)
  matchupDescription: string | null  // "Group A Winner vs Group B Runner-up"
  regulationHomeGoals: number | null
  regulationAwayGoals: number | null
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Stages Defined
From `CompetitionsClient.ts` lines 63–70:
- GROUP_STAGE
- ROUND_OF_32 (new in 2026 World Cup expansion)
- ROUND_OF_16
- QUARTER_FINALS
- SEMI_FINALS
- THIRD_PLACE
- FINAL

### Knockout Placeholders (32 Total)
`CompetitionsService.ts` lines 31–70 pre-seeds all 32 knockout matches with:
- bracketSlot: unique identifier (R32_01–R32_16, R16_01–R16_08, QF_01–QF_04, SF_01–SF_02, 3P_01, FINAL_01)
- matchupDescription: human-readable slot like "Group A Winner vs Group B Runner-up"
- stage, matchday, scheduledAt
- All team fields set to "TBD" until API provides real teams

**No group standings table exists** — standings must be computed from group-stage matches where `stage === "GROUP_STAGE"`.

---

## Predictions/Picks Model

**File**: `expectedResults/expectedResults.types.ts`

### ExpectedResult Type (Lines 11–23)
```typescript
export type ExpectedResult = {
  id: string
  userId: string
  matchId: string
  quinielaId: string | null    // null = shared; set = per-quiniela prediction
  homeScore: number
  awayScore: number
  lockedAt: Date | null
  submittedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Service Interface
`IExpectedResultsService`:
- `upsertExpectedResult(userId, matchId, homeScore, awayScore, quinielaId?) → Promise<SaveExpectedResultResult>`
- `findByUserIdAndQuiniela(userId, quinielaId | null) → Promise<ExpectedResult[]>`
- `isUserApproved(userId) → Promise<boolean>` — checks if user can submit predictions

### Repository Pattern
`IExpectedResultsRepository`:
- `upsert(input: UpsertExpectedResultInput) → Promise<void>` — INSERT or UPDATE by (user_id, match_id) or (user_id, match_id, quiniela_id)
- `findByUserIdAndQuiniela(userId, quinielaId | null) → Promise<ExpectedResult[]>`

**Per-quiniela scoping already works** — `quinielaId` column in DB; service supports `quinielaId` parameter.

---

## External Sports Data API Integration

### Provider & Client
**API**: football-data.org v4 — World Cup 2026 data

**File**: `competitions/CompetitionsClient.ts`

#### Endpoints
1. `fetchGroupStageMatches()` — fetches group-stage matches
2. `fetchAllKnockoutMatches()` — fetches all knockout-stage matches

#### HTTP Details
- **URL**: `https://api.football-data.org/v4/competitions/WC/matches?season=2026`
- **Auth**: Header `X-Auth-Token: ${FOOTBALL_DATA_ORG_API_KEY}` (from env var)
- **Response shape**: `{ matches: RawMatch[] }` where each includes `id, utcDate, status, stage, group, matchday, homeTeam { id, name, shortName, tla, crest }, awayTeam { ... }`

#### Mapping
- Maps raw API response to `MatchImportRecord` DTO (lines 150–169)
- Filters by stage; discards unused fields (goals, referees, odds)

### Integration Points in Service
`CompetitionsService.ts`:
- `importGroupStageMatches()` — calls client, upserts to DB
- `syncKnockoutMatches()` — calls client, updates bracket team details
- `syncRegulationResults(payload: SyncResultPayload[])` — takes match results, updates regulation goals, triggers scoring

### Missing
- **No group standings endpoint** — standings must be computed locally from match results (W-D-L, GF, GA, GD, points).
- **No qualification projection endpoint** — projections must be calculated via a "what-if" rule engine (if Germany beats Mexico and Japan beats Spain, then Germany and Japan advance from Group E).

---

## Caching Strategy (Existing Pattern)

**File**: `lib/ttlCache.ts`

### TtlCache Class
```typescript
class TtlCache<V> {
  constructor(ttlMs: number, maxEntries: number = 100)
  get(key: string): V | undefined        // returns undefined if absent or expired
  set(key: string, value: V): void       // evicts LRU entry if at capacity
  invalidate(key: string): void          // remove single key (call on write paths)
  clear(): void                          // remove all entries
}
```

### Usage Example: CompetitionsRepository
`competitions/CompetitionsRepository.ts` lines 26–27:
```typescript
const matchesCache = new TtlCache<Match[]>(30_000, 1)  // 30s TTL, 1 entry max
const ALL_MATCHES_CACHE_KEY = 'all_matches'
```

In `findAllMatches()` (lines 174–196):
```typescript
const cached = matchesCache.get(ALL_MATCHES_CACHE_KEY)
if (cached !== undefined) return cached
// ... fetch from DB ...
matchesCache.set(ALL_MATCHES_CACHE_KEY, matches)
return matches
```

On write (line 140, 235, 278):
```typescript
matchesCache.invalidate(ALL_MATCHES_CACHE_KEY)  // keeps reads fresh after writes
```

### Per-User Prediction Cache
`PredictionScoreRepository.ts` also caches `findPlayerPredictionsForViewer(quinielaId, userId)` results with:
- Normal TTL for regular reads
- Shorter TTL for impersonated reads (admin "View as User")

### Pattern Rules
- **Caching only in repositories** — services never directly use TtlCache
- **Write invalidation** — every write operation calls `invalidate()` to keep reads fresh
- **Process-scoped** — cache lives in a single server instance; doesn't sync across instances (expect staleness on multi-instance deployments)

### For Tournament Brackets
**Suggested cache**:
- Key: `bracket:${quinielaId}` → value: `BracketState` (matches grouped by round + predictions merged)
- TTL: 15–30 seconds (bracket is read-heavy, written only on result syncs)
- Invalidate on: result sync, prediction updates

---

## Existing Bracket/Knockout Components

**NONE exist**. The UI currently has:
- `app/[lang]/(private)/quinielas/page.tsx` — lists all user quinielas (no bracket)
- `app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/` — shows leaderboard
- `app/[lang]/(private)/quinielas/[quinielaId]/members/` — shows quiniela members
- No knockout stage visualization or bracket rendering

---

## Hexagonal Architecture Touchpoints

### Views (Presentation Layer)
**New page needed**:
- `app/[lang]/(private)/quinielas/[quinielaId]/bracket/page.tsx` (server component)
  - Fetches: quiniela membership check, all matches, user predictions for this quiniela
  - Renders: quiniela picker (dropdown/switcher), bracket visualization, prediction + result pairs

**No changes to existing views** — leaderboard, members pages remain unchanged.

### Services (Application/Domain Layer)
**Existing**:
- `QuinielasService` — already lists quinielas
- `CompetitionsService` — already fetches/syncs matches
- `ExpectedResultsService` — already handles predictions (already per-quiniela scoped)
- `LeaderboardService` — already ranks users (not needed for bracket, but can reuse scoring logic)

**New service needed** (recommend new module `tournaments/`):
- `TournamentBracketService` — owns:
  - `getGroupStandings(stage, group) → Promise<GroupStandingRow[]>` — calculate standings from group-stage matches
  - `projectQualifiers(stage, group) → Promise<PossibleTeam[]>` — which teams could advance based on remaining matches
  - `getBracketState(quinielaId) → Promise<BracketState>` — assemble full bracket with predictions merged
  - `determineBracketMatchup(bracketSlot) → Promise<Match>` — given a bracket slot, determine which teams should play (based on earlier-round winners)

### Repositories (Infrastructure Layer)
**Existing**:
- `CompetitionsRepository` — fetches/updates matches
- `ExpectedResultsRepository` — fetches/updates predictions
- `MembershipsRepository` — enforces access control

**New repository optional**:
- `TournamentBracketRepository` — if group standings are cached separately from matches:
  - `getGroupStandings(stage, group) → Promise<GroupStandingRow[]>` — fetch or compute
  - `invalidateGroupStandings(stage, group) → void` — clear cache on result sync

**Simpler approach**: Extend `CompetitionsRepository` with:
- `getGroupStandings(stage, group) → Promise<GroupStandingRow[]>` — query matches, compute standings in-memory, cache via TtlCache

### API Routes (Optional)
**For mobile JSON response**:
- `app/api/quinielas/[quinielaId]/bracket/route.ts` — GET handler
  - Returns: `{ success: true; bracket: BracketState }` or error
  - Similar to existing `/api/quinielas/[quinielaId]/members/[userId]/predictions/route.ts` (lines 1–75)
  - Can serve pre-computed bracket (matches + standings + predictions) as JSON for fast mobile load

---

## Mobile-Specific Patterns & Existing UI

### Mobile Layout Patterns (Existing)
`app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/_components/LeaderboardClient.tsx`:
- Uses responsive Tailwind (no explicit mobile breakpoints in component, relies on default Tailwind stacking)
- Sticky header with breadcrumb link back to members page
- Vertical table-like layout (rows stack on small screens)
- Floating action button for secondary actions (`ExtraQuestionsFloatingButton.tsx`)

### Tailwind & Responsive Design
- **Tailwind v4** (`@import "tailwindcss"` in global CSS)
- Supports responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Container queries not yet used in this codebase

### No Existing Patterns For
- Quiniela dropdown/switcher on a page
- Horizontal swipeable tabs or carousels
- Two-column bracket layout (likely needs CSS columns or flex-wrap)

### Recommendation for Mobile Brackets
- **Top section**: Quiniela name + switcher (dropdown or button + modal picker)
- **Bracket section**: Vertical for mobile (one match per row); can use CSS columns for tablet+
- **Match card**: Stack prediction and actual result vertically
  - Prediction row: "You predicted: 2-1"
  - Actual row: "Final: 2-1" or "TBD" (if not played)
- **Floating button**: Optional quick-link to user's predictions or leaderboard

---

## Data Flow: From Request to Page

### User Views Bracket
1. **User navigates** to `/en/quinielas/[id]/bracket`
2. **Server component** (`bracket/page.tsx`):
   - Gets session via `AuthClient.getTokenFromServerAction()` + `verifyToken()`
   - Checks `MembershipsRepository.isApprovedMember(quinielaId, userId)` (redirect if not member)
   - Calls `TournamentBracketService.getBracketState(quinielaId)` → returns `BracketState` (with cached TTL)
   - Passes to client component for interactivity
3. **Client component** (`BracketClient.tsx`):
   - Displays quiniela picker (calls `QuinielasService.listQuinielasForUser()` on page load or via API)
   - Renders bracket (matches grouped by stage)
   - For each match: shows user's prediction (from `BracketState.predictions`) + actual result

### Result Sync Updates Bracket
1. **Admin calls** `POST /api/admin/matches/sync` with regulation goals
2. **CompetitionsService.syncRegulationResults()** updates DB, calls `scoringService.recalculateMatchScores(matchId)`
3. **Bracket cache invalidated**: `bracketCache.invalidate('bracket:' + quinielaId)`
4. **Next page load** or API call re-fetches fresh bracket data

---

## Current vs. Requested: Gap Analysis

| Aspect | Current State | Requested | Implementation Gap |
|--------|---------------|-----------|-------------------|
| Quiniela listing | `QuinielasService.listQuinielasForUser()` | Same | None ✓ |
| Per-quiniela predictions | `ExpectedResult.quinielaId` column; service already supports | Same | None ✓ |
| Membership access control | `MembershipsRepository.isApprovedMember()` | Same | None ✓ |
| Match data with stages/brackets | Matches table has `stage`, `bracketSlot`, `matchupDescription` | Same | None ✓ |
| Knockout placeholders seeded | 32 records pre-seeded in DB | Same | None ✓ |
| Result syncing | `syncRegulationResults()` updates regulation_home_goals, regulation_away_goals | Same | None ✓ |
| **Bracket visualization** | Does not exist | Full bracket UI showing rounds R32→Final | **Create**: `BracketClient.tsx` component + page |
| **Group standings calculation** | Does not exist | Calculate from group-stage matches, show table with W-D-L, GF, GA, points | **Create**: `TournamentBracketService.getGroupStandings()` |
| **Qualified teams projection** | Does not exist | Show which teams could advance based on remaining group matches | **Create**: `TournamentBracketService.projectQualifiers()` |
| **Bracket matchup determination** | Does not exist | Given R32 slot "Winner R32_01 vs Winner R32_02", pull actual teams from R16_01 | **Create**: `TournamentBracketService.determineBracketMatchup()` |
| **Quiniela switcher on page** | User must navigate away to `/quinielas` list | Switch quinielas without leaving bracket | **Create**: dropdown or modal picker component |
| **Bracket caching** | Matches cached (30s); predictions not | Cache full bracket state until next update | **Extend**: `TtlCache` for bracket state |
| **Mobile-first bracket layout** | N/A | Vertical stack on mobile, columns on tablet+ | **Design & implement**: responsive CSS layout |

---

## Test Scenarios (Per TDD/SDD)

### Scenario 1: Group Stage Standings
**Given**: Group A has 4 teams, 2 matches played
- Germany beat Mexico 2-1
- Japan beat Spain 1-0
**When**: User views bracket
**Then**: Group A standings show:
- Germany: 3 points, 2 GF, 1 GA, GD +1
- Japan: 3 points, 1 GF, 0 GA, GD +1
- Spain: 0 points, 0 GF, 1 GA, GD -1
- Mexico: 0 points, 1 GF, 2 GA, GD -1

### Scenario 2: Qualified Teams Projection
**Given**: Same Group A, Spain plays Mexico next
**When**: User views "possible outcomes"
**Then**: System shows:
- If Spain wins: Spain, Germany, Japan advance; Mexico eliminated
- If draw: Spain, Germany, Japan advance; Mexico eliminated
- If Mexico wins: Germany, Japan, Mexico advance; Spain eliminated

### Scenario 3: Bracket Matchup Cascade
**Given**: Group A (Germany, Japan, Spain, Mexico), Group B (France, Canada, UK, ??)
**When**: Germany & Spain advance from Group A; France & Canada advance from Group B
**Then**: R32_01 "Group A Winner vs Group B Runner-up" shows:
- Home: Germany (A Winner)
- Away: Canada (B Runner-up)

### Scenario 4: Prediction Lock
**Given**: Match scheduled for 2026-06-28 20:00 UTC
**When**: Current time is 2026-06-28 19:45 UTC
**Then**: User can still submit prediction; at 20:00 UTC, prediction locked (`lockedAt` set)

### Scenario 5: Per-Quiniela Predictions
**Given**: User in 2 quinielas (A, B)
**When**: User submits prediction for R32_01 match in quiniela A only
**Then**: Bracket for quiniela B shows prediction as "None" or "TBD"

---

## Open Questions & Unknowns

1. **Group standings projection rules**: What determines which teams are "still alive" for qualification?
   - FIFA official rules: top 2 advance from each group.
   - Tiebreakers: head-to-head, goal diff, goals scored, disciplinary record.
   - Question: Should the "projection" engine simulate all remaining possible outcomes, or just flag "mathematically eliminated" teams?

2. **Bracket matchup derivation**: How to map "Group A Winner" (from placeholder description) to "Germany" (from group standings)?
   - Current approach: Pre-seed placeholders with descriptions; after group stage ends, compute standings, look up winner by position (1st, 2nd) in that group, and update the knockout match's home/away teams.
   - Alternative: Football-data.org API already includes bracket assignments in the knockout matches response (need to verify).

3. **Cascade timing**: When a group-stage result comes in, should R32 bracket teams be updated immediately, or only when all group games are done?
   - Spec says "update automatically as match scores/results are updated" — suggests immediate.
   - But if group isn't complete, the R32 matchups are speculative.

4. **Real-time vs. polling**: Should the bracket page re-fetch data on a timer (polling), or rely on static server render?
   - Server render: simpler, but stale until user refreshes.
   - Client polling: more interactive, but more requests.
   - Hybrid (ISR): use Next.js `revalidate` to refresh bracket data every N seconds.

5. **Mobile quiniela switcher UX**: Three options:
   - **Dropdown**: `<select>` or headless dropdown (Radix UI, etc.)
   - **Horizontal tabs**: swipeable on mobile
   - **Modal picker**: button that opens a modal with quiniela list
   - Spec just says "user must be able to rotate/switch" — no preference stated.

6. **API route vs. page-only**: Should bracket data be served via an API route (for mobile apps or client-side JS), or only via page components?
   - Spec mentions "data should be cached/stored locally" — could mean client-side cache via API route.
   - Or could mean server-side TtlCache (as with matches).

7. **Prediction display on bracket**: Should it show:
   - Just the prediction (if not played): "You predicted: 2-1"?
   - Prediction + actual (if finished): "You predicted: 2-1 | Final: 2-1 ✓"?
   - Points awarded (if finished): "You predicted: 2-1 | Final: 2-1 ✓ (+3 pts)"?
   - Spec says "two layers of information: (1) user's prediction, (2) real/actual result" — suggests stacked display.

---

## Files to Read First

1. `competitions/competitions.types.ts` — full Match domain type and port interfaces
2. `competitions/CompetitionsService.ts` — match syncing logic and knockout placeholder data
3. `competitions/CompetitionsRepository.ts` — match queries and caching pattern
4. `expectedResults/expectedResults.types.ts` — prediction type with per-quiniela support
5. `quinielas/quinielas.types.ts` & `memberships/memberships.types.ts` — access control model
6. `lib/ttlCache.ts` — caching pattern used throughout
7. `app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/page.tsx` — example of per-quiniela server component structure

---

## Recommended Modules to Create

1. **`tournaments/`** — new module for bracket logic
   - `TournamentBracketService.ts` — orchestrates bracket state assembly
   - `GroupStandingsRepository.ts` — optional; computes standings from matches
   - `tournaments.types.ts` — types: `GroupStandingRow`, `BracketState`, `PossibleQualifier`, etc.

2. **UI components**:
   - `app/[lang]/(private)/quinielas/[quinielaId]/bracket/page.tsx` — server component, page
   - `app/[lang]/(private)/quinielas/[quinielaId]/bracket/_components/BracketClient.tsx` — client component, renders bracket
   - `app/[lang]/(private)/quinielas/[quinielaId]/bracket/_components/QuinielaPicker.tsx` — dropdown or modal to switch quinielas

3. **API route (optional)**:
   - `app/api/quinielas/[quinielaId]/bracket/route.ts` — GET handler returning bracket JSON

---

## Summary of Findings

✓ **Existing foundation**:
- Quiniela membership & access control fully implemented
- Match data model includes bracket structure (bracketSlot, matchupDescription)
- Knockout placeholders pre-seeded (32 matches, R32 through Final)
- Predictions already support per-quiniela scoping
- External sports data API (football-data.org) integrated for group stage and knockout matches
- Caching pattern (TtlCache) established in repositories
- Scoring and result sync infrastructure in place

✗ **Missing**:
- Bracket visualization UI
- Group standings calculation and display
- Qualified teams projection logic
- Bracket matchup cascade (determining which teams play in which R32/R16/etc. slots)
- Quiniela switcher component on bracket page
- Mobile-first layout for bracket
- Tournament-specific service layer and repository (if standings are cached separately)

**Effort estimate**: Medium
- Core data model changes: minimal
- Service logic (standings, projections): medium (algorithm design needed)
- UI (bracket visualization, quiniela picker): medium to high (design-dependent)
- Testing: medium (many scenarios, edge cases around qualifications)

