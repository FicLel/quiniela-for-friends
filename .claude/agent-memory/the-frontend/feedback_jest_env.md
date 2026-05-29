---
name: jest-jsdom-override
description: Jest config uses testEnvironment node globally; component tests must add @jest-environment jsdom docblock to override per file
metadata:
  type: feedback
---

The global `jest.config.js` sets `testEnvironment: 'node'`. Component tests that need DOM APIs (e.g., `@testing-library/react`) must override on a per-file basis by adding `/** @jest-environment jsdom */` at the very top of the test file (before any imports).

**Why:** The project's jest config was set up for server-side unit tests (AuthService, repositories). Component tests need jsdom but the config was never changed globally.

**How to apply:** Any test file that renders React components or uses DOM APIs must start with `/** @jest-environment jsdom */` as the first line.
