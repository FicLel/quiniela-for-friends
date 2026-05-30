---
name: act-fake-timers
description: When using jest.useFakeTimers(), wrap jest.advanceTimersByTime() in act() to avoid React "not wrapped in act" warnings
metadata:
  type: feedback
---

When tests use `jest.useFakeTimers()` and advance timers that trigger React state updates (e.g., debounced setters in useEffect), wrap `jest.advanceTimersByTime()` inside `await act(async () => { ... })`.

**Why:** React 19 / react-dom-client warns if state updates occur outside act(). The debounce setTimeout fires inside advanceTimersByTime but sets React state, which must be wrapped.

**How to apply:** Any test that calls `jest.advanceTimersByTime()` and the component has state updates in setTimeout callbacks — use `await act(async () => { jest.advanceTimersByTime(n) })`.
