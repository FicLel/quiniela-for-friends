---
name: react-hooks-lint-rules
description: Strict React hooks lint rules enforced by this project — covers refs in render, Math.random in render, setState in effects
metadata:
  type: feedback
---

This project enforces strict React hooks linting rules via ESLint. Key violations to avoid:

**1. No `Math.random()` during render** (`react-hooks/purity`)
Use `useId()` (React 18+) for stable, server-safe unique IDs. Never call `Math.random()` in a `useRef` initializer passed inline, as ESLint flags this as impure render-time code.

**2. No `useState` setter called synchronously at top of `useEffect`** (`react-hooks/set-state-in-effect`)
Calling `setFoo('loading')` as the first statement in an effect body is flagged. Instead, put all state transitions inside an inner async function and call it via `void load()`.

**3. No `ref.current` accessed during render** (`react-hooks/refs`)
Reading `someRef.current` in JSX or in render-path expressions is flagged. For IDs used in `aria-controls` / `id` attributes, use `useState` or `useId()` — not `useRef`.

**Why:** The ESLint config enforces React's purity rules aggressively. These were not obvious from reading existing components but surfaced immediately on linting new autocomplete components.

**How to apply:** Any time you write a combobox/autocomplete with a listbox ID:
- Generate the ID with `const baseId = useId(); const listboxId = \`prefix-${baseId}\``
- Inside `useEffect`, wrap all logic in an inner `async` function and call `void load()`
- Never store render-used values in `useRef`; use `useState` or stable derivations instead
