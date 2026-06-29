---
name: feedback-intersectionobserver-mock
description: How to mock IntersectionObserver in jsdom tests — class-based mock that captures the callback and exposes a simulateEntries helper
metadata:
  type: feedback
---

Use a class-based `MockIntersectionObserver` that stores the callback and exposes a `simulateEntries(entries)` method. Assign it to `window.IntersectionObserver` in `beforeEach`. Use `MockIntersectionObserver.instances[0]` to get the active observer after renderHook.

**Why:** jsdom does not implement IntersectionObserver; without the mock the hook's `useEffect` will throw and no observer is created.

**How to apply:** Any test file that uses a hook containing `new IntersectionObserver(cb, opts)`. The mock must be reset (instance list cleared) in `beforeEach` and restored in `afterEach`.
