---
name: preexisting-test-failures
description: ImportMatchesButton.test.tsx fails pre-existing due to useRouter() needing app router mock; do not count as regressions
metadata:
  type: feedback
---

`ImportMatchesButton.test.tsx` always fails with "invariant expected app router to be mounted" because the component uses `useRouter()` and the test file doesn't mock next/navigation. This is a pre-existing failure, not caused by new changes.

**Why:** The test file was written without mocking the Next.js App Router context — `useRouter()` throws in jsdom without a mock.

**How to apply:** When running the full test suite, expect these 5 tests to fail and exclude them from regressions. If asked to fix them, mock `next/navigation` at the top of the test file with `jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))`.
