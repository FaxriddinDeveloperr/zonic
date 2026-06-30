-- Clan groups (Phase M follow-up): create/join/manage a clan. Creating a clan is a Gold+ feature
-- (enforced in code); anyone may join an existing clan. One clan per user.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/014_clans.sql

CREATE TABLE IF NOT EXISTS game_clan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(60) UNIQUE NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES sys_user(id),
  color         varchar(7),
  created_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_clan_member (
  user_id   uuid PRIMARY KEY REFERENCES sys_user(id),  -- one clan per user
  clan_id   uuid NOT NULL REFERENCES game_clan(id) ON DELETE CASCADE,
  role      varchar(20) NOT NULL DEFAULT 'member',      -- 'leader' | 'member'
  joined_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clan_member_clan ON game_clan_member (clan_id);
