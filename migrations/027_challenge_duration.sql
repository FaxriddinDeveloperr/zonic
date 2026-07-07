-- Challenges get a fixed time window: end_at = start_at + duration. Progress is measured over
-- [start_at, end_at]; settlement happens at end_at (auto cron or manual finish after it).
-- Backfills existing rows to a 24h window. Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/027_challenge_duration.sql

ALTER TABLE game_challenge ADD COLUMN IF NOT EXISTS end_at timestamp;
UPDATE game_challenge SET end_at = start_at + interval '24 hours' WHERE end_at IS NULL;
