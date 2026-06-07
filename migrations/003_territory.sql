-- Territory Capture (PostGIS polygon zones) — Phase 1.
-- Requires PostGIS installed on the server first:
--   sudo apt install -y postgresql-14-postgis-3
-- Then run:
--   sudo -u postgres psql -d zonic -f migrations/003_territory.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Per-user personal/team color (used for all of the user's zones).
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS color varchar(7);

-- Polygon zones. MultiPolygon so merged zones fit one row.
CREATE TABLE IF NOT EXISTS game_territory (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES sys_user(id),
  color          varchar(7) NOT NULL DEFAULT '#3B82F6',
  geom           geometry(MultiPolygon, 4326) NOT NULL,
  centroid       geometry(Point, 4326) NOT NULL,
  area_m2        double precision NOT NULL DEFAULT 0,
  run_distance_m double precision NOT NULL DEFAULT 0,
  captured_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_territory_geom     ON game_territory USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_territory_centroid ON game_territory USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_territory_owner    ON game_territory (owner_user_id);
