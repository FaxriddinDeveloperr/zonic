-- Daily pedometer model: one steps row per user per day (upsert) so re-sending the day's total
-- never double-counts. Also adds a per-user daily step goal. Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/020_daily_steps.sql

-- 1) Add a UTC `day` to each step row and backfill from started_at.
ALTER TABLE game_step_activity ADD COLUMN IF NOT EXISTS day date;
UPDATE game_step_activity SET day = (started_at AT TIME ZONE 'UTC')::date WHERE day IS NULL;

-- 2) Collapse any pre-existing duplicates per (user, day), keeping the row with the most steps.
DELETE FROM game_step_activity a
 USING game_step_activity b
 WHERE a.user_id = b.user_id AND a.day = b.day
   AND (a.steps < b.steps OR (a.steps = b.steps AND a.ctid < b.ctid));

-- 3) Enforce one row per user per day.
CREATE UNIQUE INDEX IF NOT EXISTS ux_step_user_day ON game_step_activity (user_id, day);

-- 4) Per-user daily step goal (default 10000).
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS step_goal integer NOT NULL DEFAULT 10000;
