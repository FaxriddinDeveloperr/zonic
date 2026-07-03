-- Feed comments + bookmarks (BACKEND_TODO §7). Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/017_feed_social.sql

CREATE TABLE IF NOT EXISTS game_post_comment (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES game_post(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  text       text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_post_bookmark (
  post_id    uuid NOT NULL REFERENCES game_post(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_comment_post ON game_post_comment (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_bookmark_user ON game_post_bookmark (user_id);
