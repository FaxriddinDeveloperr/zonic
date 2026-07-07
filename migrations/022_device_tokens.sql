-- FCM device tokens for push notifications. One row per device token; re-registering the same
-- token just reassigns it to the current user. Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/022_device_tokens.sql

CREATE TABLE IF NOT EXISTS game_device_token (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  token      varchar(500) NOT NULL,
  platform   varchar(20),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_device_token ON game_device_token (token);
CREATE INDEX IF NOT EXISTS ix_device_token_user ON game_device_token (user_id);
