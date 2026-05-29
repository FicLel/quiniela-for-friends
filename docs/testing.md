# Testing & Design (TDD / SDD)

We aim for **TDD** (Test‑Driven Development) and **SDD** (Specification / Scenario‑Driven Design). [web:36][web:43]

## Principles

- For new features, describe tests/specs for services and domain logic **before** implementing.
- Even though a test runner is not configured yet, new code should come with:
  - Pseudo‑tests or test descriptions.
  - Clear scenarios written near the code or in comments.

## Recommended focus

- Unit tests (or pseudo‑tests) around:
  - Services (core use cases).
  - Domain logic (bet validation, payout rules, odds handling).
- Integration tests around:
  - Repositories with TypeORM and Supabase. [web:6][web:13]  
  - Auth flows with Supabase Auth. [web:9][web:22]  

## How Claude should help

When proposing or changing code:

- Suggest how it would be tested:
  - Example test names or scenarios.
  - What should be mocked (ports) vs. what should be integration‑tested (adapters).
- When clarifying behavior, start from **user stories / scenarios**:
  - “Given a user has placed a bet… When the match ends… Then the bet is settled like this…”
- Prefer evolving services and ports based on these scenarios, then adapting repositories/clients to match.