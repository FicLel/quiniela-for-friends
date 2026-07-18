---
name: feedback-numeric-input-string-state
description: Existing convention for numeric form inputs — store as string state, parse/validate at submit time, not on every keystroke
metadata:
  type: project
---

Numeric `<input type="number">` fields in this codebase (e.g. `MatchCard.tsx` score inputs) keep the raw value as **string** state (`useState('')` / `useState('1')`) and parse with `Number.parseInt`/`Number()` only when validating or submitting — never coerce on every `onChange`.

**Why:** Coercing on every keystroke (e.g. `setValue(Number(e.target.value) || 1)`) fights the user while they're mid-edit (clearing the field, typing a new digit) and can silently snap back to a default. Keeping it as a string until submit lets the input behave naturally while still letting you compute a `isValid` boolean for disabling the submit button.

**How to apply:** When adding any numeric form field (points values, deadlines, scores), mirror this pattern: `const [raw, setRaw] = useState('1')`, `const parsed = Number.parseInt(raw, 10)`, `const isValid = Number.isInteger(parsed) && parsed >= <min>`, disable submit on `!isValid`, parse again right before calling the server action. See `app/[lang]/(private)/quinielas/[quinielaId]/admin/extra-questions/_components/AdminExtraQuestionsClient.tsx` (`pointsValue` field) for a fresh example, alongside the original in `app/[lang]/(private)/welcome/_components/MatchCard.tsx`.
