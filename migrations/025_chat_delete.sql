-- Chat deletion. "Delete conversation" is per-user (clear for me): each side has a cleared_at;
-- messages older than the caller's cleared_at are hidden from them (the peer still sees them).
-- Single-message delete removes the row for both. Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/025_chat_delete.sql

ALTER TABLE game_chat_conversation ADD COLUMN IF NOT EXISTS cleared_a_at timestamp;
ALTER TABLE game_chat_conversation ADD COLUMN IF NOT EXISTS cleared_b_at timestamp;
