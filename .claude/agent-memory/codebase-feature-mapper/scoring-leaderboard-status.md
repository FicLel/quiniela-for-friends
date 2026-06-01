---
name: scoring-leaderboard-status
description: Current state and gaps for three-point match scoring and pool leaderboards feature
metadata:
  type: project
---

## Feature Request Summary

Build:
1. **Scoring engine** – award 0–3 points per match (1pt each for home goals, away goals, outcome match)
2. **Global match sync** – sync regulation-time results, recalculate predictions idempotently
3. **Match cards** – display official vs predicted score + points earned + crowd %
4. **Pool leaderboard** – per-pool, sorted by total points, Top 3 highlighted
5. **Prediction locking** – lock at kickoff; missing predictions = 0 points

## What Already Exists

### Entities & Tables
- **matches**: home_team_name, away_team_name, scheduled_at, status, bracket_slot, matchup_description
  - **GAP**: No regulation_team_a_goals, regulation_team_b_goals, last_synced_at, status enum
- **user_expected_results**: user_id, match_id, home_score, away_score, created_at, updated_at
  - **GAP**: No locked_at, submitted_at, prediction scoring fields
- **quiniela_memberships**: role, approved_at (gating mechanism)

### Services
- `ExpectedResultsService`: upsertExpectedResult, getExpectedResultsForUser, deleteExpectedResultsForUser
  - Business rule: user must have approved membership to save predictions
- `CompetitionsService`: importGroupStageMatches, getAllMatches, syncKnockoutMatches
  - No match result sync or scoring logic yet

### UI Components
- `MatchCard.tsx` – increments/decrements prediction scores (no score display yet)
- `welcome/page.tsx` – lists matches for prediction entry

## What Needs to Be Built

### Data Model Additions (Migrations)

1. **matches** – add regulation result columns
   ```sql
   regulation_team_a_goals INTEGER NULL
   regulation_team_b_goals INTEGER NULL
   last_synced_at TIMESTAMPTZ NULL
   ```

2. **user_expected_results** – add prediction & submission metadata
   ```sql
   locked_at TIMESTAMPTZ NULL
   submitted_at TIMESTAMPTZ NULL
   ```

3. **prediction_scores** (new table) – scoring ledger
   ```sql
   id UUID PRIMARY KEY
   prediction_id UUID REFERENCES user_expected_results(id)
   team_a_goal_point INTEGER (0 or 1)
   team_b_goal_point INTEGER (0 or 1)
   outcome_point INTEGER (0 or 1)
   total_points INTEGER
   scored_at TIMESTAMPTZ
   ```

4. **pool_leaderboard_entries** (new table, derived/materialized)
   ```sql
   id UUID PRIMARY KEY
   pool_id UUID REFERENCES quinielas(id)
   user_id UUID REFERENCES users(id)
   total_points INTEGER
   exact_score_hits INTEGER
   correct_outcomes INTEGER
   rank INTEGER
   updated_at TIMESTAMPTZ
   UNIQUE (pool_id, user_id)
   ```

### Service & Repository Additions

1. **ScoringService** (new module)
   - `calculateMatchScore(prediction, official_match)` → PredictionScore
   - `syncAndRecalculatePool(poolId)` → idempotent global sync
   - `getPoolLeaderboard(poolId)` → sorted by points descending

2. **PredictionScoringRepository** (new in expectedResults or scores module)
   - `createScore(predictionId, ...fields)` 
   - `findByPrediction(predictionId)`
   - `findAllByMatch(matchId)`

3. **PoolLeaderboardRepository** (new in quinielas module)
   - `upsertEntry(poolId, userId, points, exactHits, outcomes)`
   - `getLeaderboard(poolId)` → sorted list

4. **ExpectedResultsRepository additions**
   - `findByMatchId(matchId)` – fetch all predictions for a match
   - `lockPredictions(matchIds)` – set locked_at for matches past kickoff
   - `updateLocked(predictionId, lockedAt)` – mark as locked

### UI/Route Additions

1. **Match cards** – enhance to show:
   - Official regulation result (once synced)
   - User's prediction (locked status)
   - Points earned (0–3 breakdown)
   - Crowd percentages (wins/draws/losses across all pools or global)

2. **Pool leaderboard page** – new route `quinielas/[quinielaId]/leaderboard`
   - Sorted by total_points DESC
   - Top 3 visually highlighted
   - User's current rank and points
   - Match-by-match breakdown (optional)

### API Routes

1. `POST /api/matches/sync` – global result sync
   - Fetch official results (via CompetitionsClient)
   - Update matches table
   - Create/update PredictionScore rows
   - Recalculate pool leaderboards
   - Return { success, syncedCount, error }

2. `POST /api/predictions/lock` – lock predictions at kickoff
   - Query upcoming matches by scheduled_at
   - Set locked_at on matching predictions
   - Validate user hasn't already submitted

3. `GET /api/pools/[poolId]/leaderboard` – fetch ranked entries

## Scoring Algorithm

For each prediction against a completed match:
1. **team_a_goal_point**: prediction.home_score === match.regulation_team_a_goals ? 1 : 0
2. **team_b_goal_point**: prediction.away_score === match.regulation_team_b_goals ? 1 : 0
3. **outcome_point**: 
   - If both scores correct → outcome implicitly correct → 1 point (already counted)
   - If scores differ, check outcome match:
     - Predicted outcome (home > away, draw, home < away)
     - Actual outcome (home > away, draw, home < away)
     - If match → 1 point, else → 0 points
   - **Special case**: missing prediction (no row or locked before submit) → all 0 points

## Integration Points

- Match sync reads from **CompetitionsClient** (external API)
- Scoring reads **user_expected_results** + **matches**
- Leaderboard aggregates **prediction_scores** by **quiniela_id**
- Locking gates on **scheduled_at** + **matches.status** (SCHEDULED → IN_PLAY → FINISHED)
- UI accesses via new service endpoints + React hooks

## Naming Conventions (to follow)

- Table names: snake_case (prediction_scores, pool_leaderboard_entries)
- Domain types: PascriptionScore, PoolLeaderboardEntry (camelCase)
- Services: ScoringService, PoolLeaderboardService
- Repositories: PredictionScoringRepository, PoolLeaderboardRepository
- Result types: SyncMatchesResult, CalculateScoreResult

