---
name: project-admin-impersonation
description: Admin read-only impersonation ("view as user") feature; story written 2026-06-12; 6 open questions raised
metadata:
  type: project
---

Feature: Admin impersonation (read-only). Admin enters a target user's email (`UsersRepository.findByEmail`) to "view as" that user. Strictly read-only everywhere — no writes/mutations possible while impersonating. Always-visible "Viewing as {email} / Exit" control required on every page. Primary surfaced data is the impersonated user's predictions ("expected results for matches") via `LeaderboardService.getPlayerPredictions` / `PredictionScoreRepository.findPlayerPredictionsForViewer`, with membership checks (`membershipsRepo.isApprovedMember`) resolved against the impersonated user's ID instead of `session.sub`.

**Why:** Lets admins debug/support user-reported issues (e.g. "my picks didn't save") by seeing the app exactly as that user does, without risk of accidentally mutating their data.

**Caching constraint:** Must reuse/extend the existing process-scoped `TtlCache` (`lib/ttlCache.ts`, LRU + TTL) rather than adding uncached DB reads — relates to the recent LRU work in [[project_scoring_feature]] (`scoring/LeaderboardService.ts`). Cache key strategy for impersonated reads (keyed by impersonated user ID + quinielaId) is an open question (#5).

**Open questions raised (6):**
1. Can admins impersonate other admins?
2. Self-impersonation handling?
3. Block vs. switch when starting new impersonation while already impersonating?
4. Global middleware guard vs. per-route checks for blocking writes during impersonation?
5. TTL/cache key shape for impersonated prediction reads — reuse existing per-quiniela cache instance with extended key, or separate instance?
6. Where does the always-visible "viewing as" banner live (shared layout/`<Navbar>`) to guarantee global visibility?

**How to apply:** If a technical brief or implementation follows for this feature, check whether these 6 questions were resolved before assuming defaults — especially #4 (write-block mechanism) and #6 (banner placement), which affect testability of the core read-only guarantee.
