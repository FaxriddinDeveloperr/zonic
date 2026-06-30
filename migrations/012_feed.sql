-- Social feed: posts (+images, likes) and 24h stories (Phase N).
-- Image bytes are stored on disk under uploads/feed (like avatars); these tables hold metadata.
-- Image-count-per-post and stories-per-day are gated by subscription tier in code.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/012_feed.sql

CREATE TABLE IF NOT EXISTS game_post (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  type       varchar(20) NOT NULL DEFAULT 'photo',  -- 'photo' | 'run'
  caption    text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_post_image (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES game_post(id) ON DELETE CASCADE,
  file_id varchar(200) NOT NULL,
  ordinal integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_post_like (
  post_id    uuid NOT NULL REFERENCES game_post(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS game_story (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES sys_user(id),
  file_id    varchar(200) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_user        ON game_post (user_id);
CREATE INDEX IF NOT EXISTS idx_post_created      ON game_post (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_image_post   ON game_post_image (post_id);
CREATE INDEX IF NOT EXISTS idx_story_user        ON game_story (user_id);
CREATE INDEX IF NOT EXISTS idx_story_expires     ON game_story (expires_at);
