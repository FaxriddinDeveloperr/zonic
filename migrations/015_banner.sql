-- Profile edit fields (BACKEND_TODO §1): cover/banner image + bio, socials, selected badge.
-- Image bytes are stored on disk under uploads/cover; cover_file_id holds the file id
-- (same mechanism as avatar_file_id). Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/015_banner.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS cover_file_id       varchar(200);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS bio                 varchar(500);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS instagram_username  varchar(100);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS strava_url          varchar(300);
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS selected_badge_code varchar(60);
