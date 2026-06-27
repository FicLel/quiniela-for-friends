-- Apply real UTC kickoff times, external_ids, and correct R16/QF bracket pairings
-- for all 32 knockout placeholder matches.
--
-- Source: football-data.org v4 API (WC 2026, season=2026), confirmed against
-- the official FIFA bracket.
--
-- Key corrections over previous migrations:
--   1. Real UTC times replace the approximate T20/T23Z placeholder pattern.
--      R32 slots are NOT in sequential order — they follow the actual schedule
--      (e.g. R32_04 Brazil-Japan plays before R32_02 Germany-Best3rd).
--   2. external_id pre-populated for all 32 slots so the admin sync button
--      can match by external_id instead of relying solely on positional order.
--   3. R16 matchupDescriptions corrected: the actual bracket does NOT pair
--      consecutive R32 slots (01+02, 03+04, …). Real pairings:
--        R16_01 ← R32_01 + R32_03   R16_02 ← R32_02 + R32_05
--        R16_03 ← R32_04 + R32_06   R16_04 ← R32_07 + R32_08
--        R16_05 ← R32_11 + R32_12   R16_06 ← R32_09 + R32_10
--        R16_07 ← R32_14 + R32_16   R16_08 ← R32_13 + R32_15
--   4. QF_02 and QF_03 had swapped R16 references; corrected.

-- ── Round of 32 ──────────────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at = '2026-06-28T19:00:00Z',
  external_id  = 537417
WHERE bracket_slot = 'R32_01';

UPDATE matches SET
  scheduled_at = '2026-06-29T17:00:00Z',
  external_id  = 537423
WHERE bracket_slot = 'R32_04';

UPDATE matches SET
  scheduled_at = '2026-06-29T20:30:00Z',
  external_id  = 537415
WHERE bracket_slot = 'R32_02';

UPDATE matches SET
  scheduled_at = '2026-06-30T01:00:00Z',
  external_id  = 537418
WHERE bracket_slot = 'R32_03';

UPDATE matches SET
  scheduled_at = '2026-06-30T17:00:00Z',
  external_id  = 537424
WHERE bracket_slot = 'R32_06';

UPDATE matches SET
  scheduled_at = '2026-06-30T21:00:00Z',
  external_id  = 537416
WHERE bracket_slot = 'R32_05';

UPDATE matches SET
  scheduled_at = '2026-07-01T01:00:00Z',
  external_id  = 537425
WHERE bracket_slot = 'R32_07';

UPDATE matches SET
  scheduled_at = '2026-07-01T16:00:00Z',
  external_id  = 537426
WHERE bracket_slot = 'R32_08';

UPDATE matches SET
  scheduled_at = '2026-07-01T20:00:00Z',
  external_id  = 537422
WHERE bracket_slot = 'R32_10';

UPDATE matches SET
  scheduled_at = '2026-07-02T00:00:00Z',
  external_id  = 537421
WHERE bracket_slot = 'R32_09';

UPDATE matches SET
  scheduled_at = '2026-07-02T19:00:00Z',
  external_id  = 537420
WHERE bracket_slot = 'R32_12';

UPDATE matches SET
  scheduled_at = '2026-07-02T23:00:00Z',
  external_id  = 537419
WHERE bracket_slot = 'R32_11';

UPDATE matches SET
  scheduled_at = '2026-07-03T03:00:00Z',
  external_id  = 537429
WHERE bracket_slot = 'R32_13';

UPDATE matches SET
  scheduled_at = '2026-07-03T18:00:00Z',
  external_id  = 537428
WHERE bracket_slot = 'R32_16';

UPDATE matches SET
  scheduled_at = '2026-07-03T22:00:00Z',
  external_id  = 537427
WHERE bracket_slot = 'R32_14';

UPDATE matches SET
  scheduled_at = '2026-07-04T01:30:00Z',
  external_id  = 537430
WHERE bracket_slot = 'R32_15';

-- ── Round of 16 ──────────────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at        = '2026-07-04T17:00:00Z',
  external_id         = 537376,
  matchup_description = 'Winner R32_01 vs Winner R32_03'
WHERE bracket_slot = 'R16_01';

UPDATE matches SET
  scheduled_at        = '2026-07-04T21:00:00Z',
  external_id         = 537375,
  matchup_description = 'Winner R32_02 vs Winner R32_05'
WHERE bracket_slot = 'R16_02';

UPDATE matches SET
  scheduled_at        = '2026-07-05T20:00:00Z',
  external_id         = 537377,
  matchup_description = 'Winner R32_04 vs Winner R32_06'
WHERE bracket_slot = 'R16_03';

UPDATE matches SET
  scheduled_at        = '2026-07-06T00:00:00Z',
  external_id         = 537378,
  matchup_description = 'Winner R32_07 vs Winner R32_08'
WHERE bracket_slot = 'R16_04';

UPDATE matches SET
  scheduled_at        = '2026-07-06T19:00:00Z',
  external_id         = 537379,
  matchup_description = 'Winner R32_11 vs Winner R32_12'
WHERE bracket_slot = 'R16_05';

UPDATE matches SET
  scheduled_at        = '2026-07-07T00:00:00Z',
  external_id         = 537380,
  matchup_description = 'Winner R32_09 vs Winner R32_10'
WHERE bracket_slot = 'R16_06';

UPDATE matches SET
  scheduled_at        = '2026-07-07T16:00:00Z',
  external_id         = 537381,
  matchup_description = 'Winner R32_14 vs Winner R32_16'
WHERE bracket_slot = 'R16_07';

UPDATE matches SET
  scheduled_at        = '2026-07-07T20:00:00Z',
  external_id         = 537382,
  matchup_description = 'Winner R32_13 vs Winner R32_15'
WHERE bracket_slot = 'R16_08';

-- ── Quarter-finals ────────────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at        = '2026-07-09T20:00:00Z',
  external_id         = 537383,
  matchup_description = 'Winner R16_01 vs Winner R16_02'
WHERE bracket_slot = 'QF_01';

UPDATE matches SET
  scheduled_at        = '2026-07-10T19:00:00Z',
  external_id         = 537384,
  matchup_description = 'Winner R16_05 vs Winner R16_06'
WHERE bracket_slot = 'QF_02';

UPDATE matches SET
  scheduled_at        = '2026-07-11T21:00:00Z',
  external_id         = 537385,
  matchup_description = 'Winner R16_03 vs Winner R16_04'
WHERE bracket_slot = 'QF_03';

UPDATE matches SET
  scheduled_at        = '2026-07-12T01:00:00Z',
  external_id         = 537386,
  matchup_description = 'Winner R16_07 vs Winner R16_08'
WHERE bracket_slot = 'QF_04';

-- ── Semi-finals ───────────────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at = '2026-07-14T19:00:00Z',
  external_id  = 537387
WHERE bracket_slot = 'SF_01';

UPDATE matches SET
  scheduled_at = '2026-07-15T19:00:00Z',
  external_id  = 537388
WHERE bracket_slot = 'SF_02';

-- ── Third-place play-off ──────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at = '2026-07-18T21:00:00Z',
  external_id  = 537389
WHERE bracket_slot = '3P_01';

-- ── Final ─────────────────────────────────────────────────────────────────────
UPDATE matches SET
  scheduled_at = '2026-07-19T19:00:00Z',
  external_id  = 537390
WHERE bracket_slot = 'FINAL_01';
