---
name: getbylabeltext-aria-label-conflict
description: getByLabelText matches aria-label on buttons too, not just <label for=...>; use exact label text strings to avoid ambiguity
metadata:
  type: feedback
---

`getByLabelText` in Testing Library matches both `<label for="...">` elements AND elements with `aria-label` attributes. When a password show/hide toggle button has `aria-label="Show confirm password"`, querying with `/confirm password/i` will match both the input (via its label) and the button (via its aria-label), causing "Found multiple elements" errors.

**Why:** Discovered when adding password show/hide toggles — the toggle button's aria-label contained the same substring as the field label.

**How to apply:** Use the exact label text string (e.g., `'Confirm password'`) instead of a regex when querying for inputs that have adjacent buttons with related aria-labels. Alternatively, use `screen.getByRole('textbox', { name: ... })` or `screen.getByDisplayValue(...)` as alternatives.
