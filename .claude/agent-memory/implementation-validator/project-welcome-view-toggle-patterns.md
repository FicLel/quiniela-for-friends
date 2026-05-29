---
name: project-welcome-view-toggle-patterns
description: Recurring patterns from Welcome page view-toggle + knockout section validation: architecture bypass, timezone grouping gap, missing edge-case tests
metadata:
  type: project
---

## Key patterns observed in the Welcome page (view toggle + date grouping + knockout) feature

**Architecture bypass in page.tsx is brief-approved but still flagged.**
The technical brief explicitly says "Single DB query: findAllMatches() in page.tsx", authorizing the page to import CompetitionsRepository directly. This conflicts with docs/architecture.md ("UI calls services, not repositories") and docs/modules.md ("Views NEVER import repositories"). The brief overrode the rule — flag as Important but note the brief explicitly allowed it.

**Why:** Pattern of brief decisions overriding architectural conventions is recurring. Always cross-check brief decisions against architecture docs and surface the tension even if the brief won.

**How to apply:** When a brief decision directly violates an architectural rule, flag as Important (not Critical) and cite both documents. Do not treat it as Critical unless there's a concrete harm (e.g., security risk from bypassing a service layer).

---

**toLocalDateKey uses Date local-time getters — correct in a 'use client' component.**
The `toLocalDateKey` function in DateGroupedView.tsx uses `d.getFullYear()`, `d.getMonth()`, `d.getDate()` — these use the runtime's local timezone. Because the component is `'use client'`, they resolve to browser timezone on the client. This is the correct pattern per the brief ("Date headings computed client-side"). The test comment acknowledges this by using UTC midnight to avoid test runner timezone flakiness.

**How to apply:** Don't flag Date local-time getters as bugs in 'use client' components when the brief explicitly requires browser-timezone computation. Do flag the missing midnight-boundary test as an edge case omission.

---

**Midnight boundary edge case consistently untested.**
The story explicitly calls out: "matches at 23:45 UTC may land on different calendar dates for UTC−5 vs UTC+1 users." Neither DateGroupedView.test.tsx nor any other test verifies this scenario. Flag as Important.

---

**findAllGroupStageMatches in repository does not filter by stage.**
CompetitionsRepository.findAllGroupStageMatches() issues no `.eq('stage', 'GROUP_STAGE')` filter — it returns all matches. This is a pre-existing bug not in scope for this feature, but should be noted if a future feature calls this method expecting only group-stage data.

---

**AC coverage for date heading locale format (AC #4) was not tested.**
No test asserts that the h2 heading text matches "Saturday, June 14" or "sábado, 14 de junio" format. The DateGroupedView tests only count the number of headings, not their content format. Flag as Minor.

**Related:** [[project-create-first-admin-patterns]] (pattern of missing i18n format tests)
