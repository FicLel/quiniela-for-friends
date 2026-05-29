---
name: feedback-test-mock-ordering
description: In Jest tests for repositories, prime the repo instance first (call makeRepo/new Repo) before priming data mocks like mockSingle, to avoid mock queue leakage between tests
metadata:
  type: feedback
---

In `UsersRepository` tests (and repository tests generally), the pattern that works cleanly is:

1. Call `makeRepo()` (or `new Repo()`) BEFORE calling `mockSingle.mockResolvedValueOnce(...)`.
2. `makeRepo()` primes the schema-check mock (`mockMaybeSingle`), then creates the instance.
3. After the instance is created, prime the data-query mock.

If you prime data mocks BEFORE calling `makeRepo()`, Jest's `beforeEach(jest.clearAllMocks)` can cause queue-ordering issues where a previous test's un-consumed mock value bleeds into the next test.

**Why:** Discovered during the `verifySchema` implementation when tests showed ROW data returning for "returns null" cases — the schema mock and data mock queues were getting out of sync.

**How to apply:** Any time you write a repository test that has both a schema-check layer and a data-query layer, always create the repo instance first, then prime the data mock.
