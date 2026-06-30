-- Challenges / Duels between friends (Phase I). Matches the TZ challenge object
-- (goalType, start time, bet, status). Bet is recorded; automatic escrow + winner settlement is a
-- follow-up that depends on the live-result engine (the TZ models live monitoring on the client).
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/009_challenges.sql

CREATE TABLE IF NOT EXISTS game_challenge (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES sys_user(id),
  opponent_id   uuid NOT NULL REFERENCES sys_user(id),
  goal_type     varchar(20) NOT NULL,                      -- 'running' | 'territory' | 'steps'
  start_at      timestamp NOT NULL,
  bet           bigint NOT NULL DEFAULT 0,                 -- Tanga staked (informational for now)
  status        varchar(20) NOT NULL DEFAULT 'pending',    -- pending|accepted|declined|finished
  created_at    timestamp NOT NULL DEFAULT now(),
  responded_at  timestamp
);

CREATE INDEX IF NOT EXISTS idx_challenge_challenger ON game_challenge (challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenge_opponent   ON game_challenge (opponent_id);
