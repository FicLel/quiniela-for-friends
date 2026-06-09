---
name: leaderboard-structure
description: Complete data model and service structure for leaderboard scoring, predictions, and per-match data
metadata:
  type: reference
---

## LeaderboardRow Type (Current)

**File**: `scoring/scoring.types.ts` (lines 30–38)

```typescript
export type LeaderboardRow = {
  rank: number
  userId: string
  email: string
  totalPoints: number
  exactScoreHits: number
  correctOutcomeHits: number
  predictedMatchCount: number
}
```

**Missing fields for enhanced display**:
- `pointsFromExactScores` (sum of points awarded only for exact score predictions)
- `pointsFromOutcomeHits` (sum of points awarded only for outcome predictions)
- `pointsFromExtraQuestions` (sum of extra question points)

## Scoring Calculation Flow

**Files**:
- `scoring/ScoringService.ts` – contains pure `calculateScore()` function that scores one prediction against match result
- `scoring/PredictionScoreRepository.ts` – aggregates scores by user in `aggregateByQuiniela()` (lines 193–286)
- `scoring/LeaderboardService.ts` – sorts/ranks aggregates and enriches with user emails

### Aggregation Logic (in PredictionScoreRepository.aggregateByQuiniela)

1. Joins `prediction_scores` with `user_expected_results` to get `user_id`
2. Counts exact score hits (when `home_goal_point == 1 && away_goal_point == 1`)
3. Counts outcome hits (when `outcome_point == 1`)
4. Sums `total_points`
5. Merges in extra question results from `extra_question_results` table (lines 260–283)

## ExpectedResult Type (Predictions)

**File**: `expectedResults/expectedResults.types.ts` (lines 11–23)

```typescript
export type ExpectedResult = {
  id: string
  userId: string
  matchId: string
  quinielaId: string | null      // null = shared prediction, set = per-quiniela
  homeScore: number
  awayScore: number
  lockedAt: Date | null
  submittedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

**Repository methods**:
- `findByUserId(userId)` – returns all predictions for a user (any match)
- `findByUserIdAndQuiniela(userId, quinielaId)` – returns predictions for user scoped to a quiniela
- `findByMatchId(matchId)` – returns all predictions for a single match

## Match Type (Closure Detection)

**File**: `competitions/competitions.types.ts` (lines 11–36)

```typescript
export type Match = {
  // ... team info, schedule ...
  status: string  // "FINISHED" | "IN_PLAY" | "SCHEDULED" | "CANCELLED" etc
  regulationHomeGoals: number | null
  regulationAwayGoals: number | null
  // ...
}
```

**Match is "closed" when**:
- `status === "FINISHED"` AND
- `regulationHomeGoals !== null` AND `regulationAwayGoals !== null`

## Extra Questions Integration

**File**: `extraQuestions/extraQuestions.types.ts`

- `ExtraQuestionResult` table stores per-user points (0 or 1) per question per quiniela
- Already aggregated into `totalPoints` in `PredictionScoreRepository.aggregateByQuiniela()` (lines 260–283)
- Points breakdown available in `extra_question_results` table

## Data Access Patterns

### For Leaderboard Page
1. Page: `app/[lang]/(private)/quinielas/[quinielaId]/leaderboard/page.tsx` (server component)
2. Service: `LeaderboardService.getLeaderboard(quinielaId)` → returns ranked `LeaderboardRow[]`
3. Repository: `PredictionScoreRepository.aggregateByQuiniela(quinielaId)` → joins scores, predictions, extra questions

### For Per-User Predictions (Not Yet Exposed)
1. Service: `ExpectedResultsService.findByUserIdAndQuiniela(userId, quinielaId)`
2. Repository: `ExpectedResultsRepository.findByUserIdAndQuiniela(userId, quinielaId)` → returns `ExpectedResult[]`
3. Need to: join with `matches` table to filter by `status === "FINISHED"` and have `regulationHomeGoals/awayGoals`

## I18n Dictionary Keys (leaderboard)

**File**: `i18n/dictionaries/en.json` (lines 214–238)

Existing keys:
- `colExact`, `colOutcome`, `colPts` – column abbreviations
- `colExactTitle`, `colOutcomeTitle`, `colPtsTitle` – tooltips
- `rule1Label`, `rule1Desc` – scoring system explanations

**Needed for enhanced columns**:
- `colPointsFromExact` / `colPointsFromExactTitle`
- `colPointsFromOutcome` / `colPointsFromOutcomeTitle`
- `colPointsFromExtra` / `colPointsFromExtraTitle`

## Related Modules

- `bets/` – does not exist; "predictions" are called "expectedResults"
- `competitions/` – holds `Match` type with closure detection fields
- `scoring/` – owns all scoring logic and types
- `expectedResults/` – owns prediction storage and retrieval
- `extraQuestions/` – owns extra question answers and results
