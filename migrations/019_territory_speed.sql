-- Store the run's duration + average speed on each captured territory so Activity History can
-- return avgSpeed for territory items (mobile request). Populated on new captures; old rows = 0.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/019_territory_speed.sql

ALTER TABLE game_territory ADD COLUMN IF NOT EXISTS duration_seconds integer          NOT NULL DEFAULT 0;
ALTER TABLE game_territory ADD COLUMN IF NOT EXISTS avg_speed_kmh    double precision NOT NULL DEFAULT 0;
