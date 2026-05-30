---
name: getbytext-dropdown-collision
description: When filter dropdowns and table badges share the same text (e.g. "Active", "Pending"), getByText throws MultipleElements — use getAllByText
metadata:
  type: feedback
---

In the UsersClient, the status filter `<select>` has options "Active" and "Pending" that share text with the table row badge spans. `getByText(dict.badgeActive)` throws a "multiple elements" error.

**Why:** `getByText` finds both the `<option>` and the `<span>` badge.

**How to apply:** Use `getAllByText(text).length > 0` for any text that appears in both filter dropdowns and status badges. Similarly, quiniela names appear in the quiniela filter dropdown AND the detail panel — use `getAllByText`.
