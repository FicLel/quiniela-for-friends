---
name: import-button-pattern
description: Pattern for admin action buttons in ImportMatchesButton.tsx — sub-components with useTransition, fetch to /api/admin/*, inline status/alert paragraphs
metadata:
  type: project
---

The admin action panel on the welcome page uses `ImportMatchesButton.tsx` at `app/[lang]/(private)/welcome/_components/ImportMatchesButton.tsx`. New admin actions are added as private sub-components inside that same file, not as separate files.

Each sub-component follows this exact shape:
- Named `*ButtonInner` (e.g., `SyncPlayersButtonInner`)
- Props: `{ dict: Dictionary['welcome'] }`
- Uses `useTransition` for isPending loading state
- Calls a Server Action imported from `../actions` (NOT a direct fetch to an API route — though the pattern for route-backed ones uses `fetch('POST /api/admin/...')`)
- `<p role="status">` on success, `<p role="alert">` on error
- Button disabled + spinner when isPending
- Colors distinguish actions: green (import), blue (seed), amber (sync knockout), purple is available for new actions

The parent `ImportMatchesButton` renders all sub-components in a `<div className="flex flex-col gap-4">` and returns null for non-admin users.

**Why:** Product owner confirmed in CR2: "copy the existing pattern exactly." No new component files, no new pattern.

**How to apply:** Every future admin action button on the welcome page goes inside this file as a new `*ButtonInner` sub-component. The Server Action that backs it goes into `app/[lang]/(private)/welcome/actions.ts`.
