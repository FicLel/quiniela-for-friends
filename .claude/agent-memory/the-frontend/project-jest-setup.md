---
name: project-jest-setup
description: Jest configuration patterns for this project — jsdom environment, jest-dom matchers, missing user-event
metadata:
  type: project
---

**Jest config option for setup files:** `setupFilesAfterEnv` (NOT setupFilesAfterFramework, setupFilesAfterEach, or any other variant).

**jsdom:** Jest global `testEnvironment` is `node`. Component tests must add `/** @jest-environment jsdom */` as the FIRST line.

**jest-dom matchers:** Import via `jest.setup.ts` (which does `import '@testing-library/jest-dom'`) configured in `jest.config.js` as `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`. TypeScript types via `"types": ["jest", "@testing-library/jest-dom"]` in tsconfig.

**user-event NOT available:** `@testing-library/user-event` is NOT in the project dependencies. Use `fireEvent` from `@testing-library/react` instead. For async interactions with Server Actions, combine `act(async () => { fireEvent.click(...) })` with `waitFor`.

**Test path pattern option:** In Jest 30+, the CLI option is `--testPathPatterns` (plural), NOT `--testPathPattern`.
