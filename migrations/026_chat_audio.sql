-- Voice messages: store the audio clip's duration (seconds) so the recipient's UI can show the
-- length without decoding the file. attachment_type gains a 'voice' value (no schema change needed).
-- Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/026_chat_audio.sql

ALTER TABLE game_chat_message ADD COLUMN IF NOT EXISTS attachment_duration_seconds integer;
