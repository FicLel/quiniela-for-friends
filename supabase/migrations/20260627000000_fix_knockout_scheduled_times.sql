-- Fix placeholder scheduled_at times for R32, R16, and QF knockout matches.
--
-- Problems fixed:
--   1. R32_02 and R32_03 had identical timestamps (2026-06-29T00:00:00Z),
--      causing non-deterministic positional pairing in updateKnockoutTeams().
--   2. T00:00:00Z values appear as 2 AM CEST (Spain summer) — not realistic
--      match kickoff times. Changed to T20:00:00Z / T23:00:00Z per UTC day.
--   3. R16 and QF had the same duplicate-time and T00:00:00Z problems.
--
-- Pattern: 2 matches per UTC calendar day, first at T20:00Z, second at T23:00Z.
-- These are placeholder times only — syncKnockoutMatches() will overwrite them
-- with the real FIFA kickoff times from the football-data.org API.
--
-- R16 moved to July 7–10 (after R32 ends July 5).
-- QF moved to July 11–12 (after R16 ends July 10).
-- SF / 3P / FINAL times are already unique and sensible; left unchanged.

-- Round of 32
UPDATE matches SET scheduled_at = '2026-06-28T20:00:00Z' WHERE bracket_slot = 'R32_01';
UPDATE matches SET scheduled_at = '2026-06-28T23:00:00Z' WHERE bracket_slot = 'R32_02';
UPDATE matches SET scheduled_at = '2026-06-29T20:00:00Z' WHERE bracket_slot = 'R32_03';
UPDATE matches SET scheduled_at = '2026-06-29T23:00:00Z' WHERE bracket_slot = 'R32_04';
UPDATE matches SET scheduled_at = '2026-06-30T20:00:00Z' WHERE bracket_slot = 'R32_05';
UPDATE matches SET scheduled_at = '2026-06-30T23:00:00Z' WHERE bracket_slot = 'R32_06';
UPDATE matches SET scheduled_at = '2026-07-01T20:00:00Z' WHERE bracket_slot = 'R32_07';
UPDATE matches SET scheduled_at = '2026-07-01T23:00:00Z' WHERE bracket_slot = 'R32_08';
UPDATE matches SET scheduled_at = '2026-07-02T20:00:00Z' WHERE bracket_slot = 'R32_09';
UPDATE matches SET scheduled_at = '2026-07-02T23:00:00Z' WHERE bracket_slot = 'R32_10';
UPDATE matches SET scheduled_at = '2026-07-03T20:00:00Z' WHERE bracket_slot = 'R32_11';
UPDATE matches SET scheduled_at = '2026-07-03T23:00:00Z' WHERE bracket_slot = 'R32_12';
UPDATE matches SET scheduled_at = '2026-07-04T20:00:00Z' WHERE bracket_slot = 'R32_13';
UPDATE matches SET scheduled_at = '2026-07-04T23:00:00Z' WHERE bracket_slot = 'R32_14';
UPDATE matches SET scheduled_at = '2026-07-05T20:00:00Z' WHERE bracket_slot = 'R32_15';
UPDATE matches SET scheduled_at = '2026-07-05T23:00:00Z' WHERE bracket_slot = 'R32_16';

-- Round of 16
UPDATE matches SET scheduled_at = '2026-07-07T20:00:00Z' WHERE bracket_slot = 'R16_01';
UPDATE matches SET scheduled_at = '2026-07-07T23:00:00Z' WHERE bracket_slot = 'R16_02';
UPDATE matches SET scheduled_at = '2026-07-08T20:00:00Z' WHERE bracket_slot = 'R16_03';
UPDATE matches SET scheduled_at = '2026-07-08T23:00:00Z' WHERE bracket_slot = 'R16_04';
UPDATE matches SET scheduled_at = '2026-07-09T20:00:00Z' WHERE bracket_slot = 'R16_05';
UPDATE matches SET scheduled_at = '2026-07-09T23:00:00Z' WHERE bracket_slot = 'R16_06';
UPDATE matches SET scheduled_at = '2026-07-10T20:00:00Z' WHERE bracket_slot = 'R16_07';
UPDATE matches SET scheduled_at = '2026-07-10T23:00:00Z' WHERE bracket_slot = 'R16_08';

-- Quarter-finals
UPDATE matches SET scheduled_at = '2026-07-11T20:00:00Z' WHERE bracket_slot = 'QF_01';
UPDATE matches SET scheduled_at = '2026-07-11T23:00:00Z' WHERE bracket_slot = 'QF_02';
UPDATE matches SET scheduled_at = '2026-07-12T20:00:00Z' WHERE bracket_slot = 'QF_03';
UPDATE matches SET scheduled_at = '2026-07-12T23:00:00Z' WHERE bracket_slot = 'QF_04';
