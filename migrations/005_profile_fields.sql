-- Onboarding / Profile fields (Phase D) — the 7 synced fields from the Profile TZ plus the
-- derived health metrics are computed on read (not stored). Single source of truth = sys_user.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/005_profile_fields.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS country_id integer REFERENCES info_country(id);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS region_id  integer REFERENCES info_region(id);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS age        integer;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS height_cm  double precision;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS weight_kg  double precision;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS gender     varchar(10);  -- 'male' | 'female'
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS level      varchar(20);  -- 'beginner' | 'professional'

CREATE INDEX IF NOT EXISTS idx_sys_user_country ON sys_user (country_id);
CREATE INDEX IF NOT EXISTS idx_sys_user_region  ON sys_user (region_id);
