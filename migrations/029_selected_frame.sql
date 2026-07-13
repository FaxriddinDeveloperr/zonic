-- Avatar frame the user has equipped. Stored server-side (like selected_badge_code) so OTHER
-- users see it on leaderboards, the map, friends lists and public profiles.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/029_selected_frame.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS selected_frame_code varchar(60);
