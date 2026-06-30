-- Steps / pedometer activities (Phase E). No GPS route — just a step count over a time window.
-- Feeds the "Qadam" (Steps) stats dimension and the unified Activity History.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/006_steps.sql

CREATE TABLE IF NOT EXISTS game_step_activity (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES sys_user(id),
  started_at       timestamp NOT NULL,
  ended_at         timestamp NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  steps            integer NOT NULL DEFAULT 0,
  distance_km      double precision NOT NULL DEFAULT 0,  -- optional estimate from step length
  created_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_step_activity_user       ON game_step_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_step_activity_started_at ON game_step_activity (started_at DESC);
