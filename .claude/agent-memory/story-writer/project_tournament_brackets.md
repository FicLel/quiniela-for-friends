---
name: project-tournament-brackets
description: Mobile-first Tournament Brackets screen per quiniela showing knockout bracket, prediction-vs-actual results, quiniela switcher, cached football-data.org sync; story written 2026-06-24; split into primary view story + 2 follow-ons; 6 open questions raised
metadata:
  type: project
---

Tournament Brackets feature story produced 2026-06-24.

The raw idea bundled multiple goals; split per [[user-role]]'s preference for atomic stories:
- **Primary story (full)**: read-only bracket view (Round of 32 -> Final) per quiniela, quiniela switcher, prediction shown alongside actual result once played, mobile-first, cache-backed reads (no re-fetch from football-data.org within cache window).
- **Follow-on 1**: Group Stage Projection Story — possible/projected final group standings and qualification scenarios. Needs a new standings/projection service that does not exist yet.
- **Follow-on 2**: Bracket Cascade Resolution Service Story — backend service to resolve placeholder matchup descriptions ("Group A Winner vs Group B Runner-up") into real team names as groups become decided. Partial dependency of the primary story's AC8 (later-round matchups reflecting earlier results).

Key existing building blocks identified by codebase-feature-mapper, reused in the story:
- `competitions/CompetitionsRepository.ts` already has a 30s `TtlCache` wired in and invalidated on writes — natural pattern to extend for bracket caching.
- `competitions/CompetitionsService.ts` pre-seeds 32 knockout placeholders with `bracketSlot` and `matchupDescription`, and has `syncRegulationResults()` which updates goals + triggers `ScoringService.recalculateMatchScores()`.
- `expectedResults.types.ts` already supports per-quiniela predictions (`quinielaId: string | null`).
- Confirmed gaps (none of these exist yet): bracket visualization UI, group standings calculation, qualification projection logic, matchup cascade resolution, quiniela switcher component, mobile-first bracket layout.

**Why:** This is the first story to combine knockout-stage visualization with the existing prediction/scoring infrastructure — it's a major new screen, not an extension of an existing one, and it surfaces a real architectural gap (no cascade resolution service exists to turn "Group A Winner" into an actual team name).

**How to apply:** When asked about brackets, group projections, or matchup cascade work, treat the projection logic and cascade resolution as separate backend-heavy stories from the bracket *viewing* experience. Don't let projection/cascade complexity block scoping the view-only story. Surface the 6 open questions below before implementation begins.

Open questions still unresolved at story time (ask before implementing):
1. Group qualification projection semantics: all mathematically possible outcomes vs. single "most likely" projection? What FIFA tiebreak rules apply?
2. Bracket cascade resolution timing: resolve placeholders as soon as partially determined, or only once a group is fully mathematically settled?
3. Mobile UI treatment for showing prediction vs. actual result on the same card (stacked/side-by-side/color-coded) — deferred to design stage.
4. Caching/invalidation strategy: reuse the existing 30s `TtlCache` pattern from `CompetitionsRepository`, or does merging predictions into the cache need a different scheme? Deferred to technical brief, but caching is a first-class AC (not an afterthought).
5. Quiniela-switching UX pattern on mobile: dropdown vs. swipeable tabs vs. modal picker — deferred to design stage.
6. Third-place match handling: should THIRD_PLACE appear in the bracket visualization, and if so where (side branch vs. separate card vs. omitted)?

[[user-role]]
