-- Presence: remember when a user was last online (shown as "last seen ..." when offline).
-- Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/024_last_seen.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS last_seen_at timestamp;
