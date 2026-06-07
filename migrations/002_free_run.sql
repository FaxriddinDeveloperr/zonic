-- Free Run feature (POST /FreeRun/Save, GET /FreeRun/GetHistory, GET /FreeRun/GetLeaderboard).
-- Standalone table: a free run is saved as one completed record with its route points inline (JSONB).
-- Safe to run more than once. Run on the server before deploying the free-run build:
--   psql -U postgres -d zonic -f migrations/002_free_run.sql

CREATE TABLE IF NOT EXISTS game_free_run (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES sys_user(id),
  started_at        timestamp NOT NULL,
  ended_at          timestamp NOT NULL,
  duration_seconds  integer NOT NULL DEFAULT 0,
  pace_min_per_km   double precision NOT NULL DEFAULT 0,
  average_speed_kmh double precision NOT NULL DEFAULT 0,
  distance_km       double precision NOT NULL DEFAULT 0,
  route_points      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "lat": .., "lng": .., "ts": "ISO-8601" }]
  created_at        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_free_run_user_id    ON game_free_run (user_id);
CREATE INDEX IF NOT EXISTS idx_game_free_run_started_at ON game_free_run (started_at DESC);

-- Avatar: ensure the column the app reads/writes exists (sys_user.avatar_file_id).
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS avatar_file_id varchar(200);
