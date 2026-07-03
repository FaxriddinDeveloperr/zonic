-- Notifications (BACKEND_TODO §2). Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/016_notifications.sql

CREATE TABLE IF NOT EXISTS game_notification (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  type       varchar(30) NOT NULL,              -- friend_request | achievement | clan | challenge | system
  title      varchar(200) NOT NULL,
  body       text,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON game_notification (user_id, created_at DESC);
