---
name: getbytext-multiple-elements
description: When form selects and badge labels share the same text, getByText throws "multiple elements". Use getAllByText with a length check instead.
metadata:
  type: feedback
---

When a component renders both a role badge (e.g. "Admin") AND a form `<select>` with an `<option>Admin</option>`, `screen.getByText('Admin')` will throw "Found multiple elements". Use `screen.getAllByText('Admin').length > 0` or check a specific role (e.g. `getByRole('option', { name: 'Admin' })`).

**Why:** Discovered during MembersClient tests — the invite form's role select has the same option text as the member role badges.

**How to apply:** Whenever a component combines a data table/list with a form that shares vocabulary (role names, status labels), default to `getAllByText` for those shared strings in tests.

See also: [[getbylabeltext-aria-conflict]]
