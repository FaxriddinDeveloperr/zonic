-- Challenge bet settlement (Phase I follow-up) + profile privacy zone (Phase N follow-up).
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/013_challenge_settlement_privacy.sql

-- Settlement: who won and when (bets are escrowed from both wallets on accept, paid out on finish).
ALTER TABLE game_challenge ADD COLUMN IF NOT EXISTS winner_user_id uuid REFERENCES sys_user(id);
ALTER TABLE game_challenge ADD COLUMN IF NOT EXISTS finished_at    timestamp;

-- Privacy zone: hide the user's home area on shared maps (client blurs; server clips route points).
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS privacy_lat      double precision;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS privacy_lng      double precision;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS privacy_radius_m double precision;
