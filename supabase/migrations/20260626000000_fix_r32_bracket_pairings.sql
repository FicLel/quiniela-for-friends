-- Fix Round of 32 bracket pairings to match the official FIFA WC 2026 bracket.
-- The original seed had invented group cross-pairings; this corrects all 16 R32
-- matchup_description values to the official bracket published by FIFA.
--
-- R16 slot references (Winner R32_01 vs Winner R32_02, etc.) are unchanged —
-- only the matchup_description and scheduled_at on each R32 row change.
--
-- Eight of the 16 R32 matches involve a "Best 3rd Place" qualifier whose exact
-- identity is determined by FIFA's Annex C lookup once all groups finish.
-- Those sides show as TBD until syncKnockoutMatches() fills them in.

UPDATE matches SET
  matchup_description = 'Group A Runner-up vs Group B Runner-up',
  scheduled_at        = '2026-06-28T20:00:00Z'
WHERE bracket_slot = 'R32_01';

UPDATE matches SET
  matchup_description = 'Group E Winner vs Best 3rd Place',
  scheduled_at        = '2026-06-29T00:00:00Z'
WHERE bracket_slot = 'R32_02';

UPDATE matches SET
  matchup_description = 'Group F Winner vs Group C Runner-up',
  scheduled_at        = '2026-06-29T00:00:00Z'
WHERE bracket_slot = 'R32_03';

UPDATE matches SET
  matchup_description = 'Group C Winner vs Group F Runner-up',
  scheduled_at        = '2026-06-29T23:00:00Z'
WHERE bracket_slot = 'R32_04';

UPDATE matches SET
  matchup_description = 'Group I Winner vs Best 3rd Place',
  scheduled_at        = '2026-06-30T00:00:00Z'
WHERE bracket_slot = 'R32_05';

UPDATE matches SET
  matchup_description = 'Group E Runner-up vs Group I Runner-up',
  scheduled_at        = '2026-06-30T20:00:00Z'
WHERE bracket_slot = 'R32_06';

UPDATE matches SET
  matchup_description = 'Group A Winner vs Best 3rd Place',
  scheduled_at        = '2026-06-30T23:00:00Z'
WHERE bracket_slot = 'R32_07';

UPDATE matches SET
  matchup_description = 'Group L Winner vs Best 3rd Place',
  scheduled_at        = '2026-07-01T00:00:00Z'
WHERE bracket_slot = 'R32_08';

UPDATE matches SET
  matchup_description = 'Group D Winner vs Best 3rd Place',
  scheduled_at        = '2026-07-01T20:00:00Z'
WHERE bracket_slot = 'R32_09';

UPDATE matches SET
  matchup_description = 'Group G Winner vs Best 3rd Place',
  scheduled_at        = '2026-07-01T23:00:00Z'
WHERE bracket_slot = 'R32_10';

UPDATE matches SET
  matchup_description = 'Group K Runner-up vs Group L Runner-up',
  scheduled_at        = '2026-07-02T00:00:00Z'
WHERE bracket_slot = 'R32_11';

UPDATE matches SET
  matchup_description = 'Group H Winner vs Group J Runner-up',
  scheduled_at        = '2026-07-02T20:00:00Z'
WHERE bracket_slot = 'R32_12';

UPDATE matches SET
  matchup_description = 'Group B Winner vs Best 3rd Place',
  scheduled_at        = '2026-07-02T23:00:00Z'
WHERE bracket_slot = 'R32_13';

UPDATE matches SET
  matchup_description = 'Group J Winner vs Group H Runner-up',
  scheduled_at        = '2026-07-03T00:00:00Z'
WHERE bracket_slot = 'R32_14';

UPDATE matches SET
  matchup_description = 'Group K Winner vs Best 3rd Place',
  scheduled_at        = '2026-07-03T20:00:00Z'
WHERE bracket_slot = 'R32_15';

UPDATE matches SET
  matchup_description = 'Group D Runner-up vs Group G Runner-up',
  scheduled_at        = '2026-07-03T23:00:00Z'
WHERE bracket_slot = 'R32_16';
