---
name: testing-libs-available
description: Only @testing-library/react and @testing-library/jest-dom are installed; @testing-library/user-event is NOT available
metadata:
  type: feedback
---

Installed testing libraries (as of project init):
- `@testing-library/react` v16.3.2 — use `render`, `screen`, `waitFor`, `fireEvent`, `act`
- `@testing-library/jest-dom` — matcher extensions like `toBeInTheDocument`, `toHaveTextContent`
- `@types/jest` v30 — jest globals

NOT installed:
- `@testing-library/user-event` — do NOT import this. Use `fireEvent` instead for user interactions.

**Why:** Package.json only lists react and jest-dom as devDependencies. user-event was never installed.

**How to apply:** Whenever writing component tests, simulate user interactions with `fireEvent.change`, `fireEvent.click`, `fireEvent.submit`, wrapped in `act` for async state updates.

**Label ambiguity gotcha:** `getByLabelText(/partial regex/i)` will throw if the pattern matches multiple labels. When form labels share substrings (e.g. "New password" and "Confirm new password"), use exact string matching: `getByLabelText('New password')` instead of `/new password/i`.
