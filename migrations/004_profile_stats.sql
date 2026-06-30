-- Profile Statistics, Personal Bests & Achievements (Phase A/B/C).
-- Reads existing data (game_free_run = running, game_territory = territory) for stats and
-- personal bests — those need NO new tables. Only achievement UNLOCK state is persisted here,
-- so a badge keeps its unlock date even if the user later loses territory.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/004_profile_stats.sql

CREATE TABLE IF NOT EXISTS game_user_achievement (
  user_id          uuid NOT NULL REFERENCES sys_user(id),
  achievement_code varchar(60) NOT NULL,   -- matches a code in src/common/achievements.ts
  unlocked_at      timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS idx_user_achievement_user ON game_user_achievement (user_id);
