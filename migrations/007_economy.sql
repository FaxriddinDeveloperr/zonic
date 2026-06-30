-- Economy: Tanga (persistent coin) + XP (expiring) wallet, and the Market (Phase J + K).
-- Two separate currencies per the agreed design: XP = rating/level (expires daily), Tanga = the
-- spendable balance used only in the Market. Earn-rates live in .env (config), not here.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/007_economy.sql

-- One wallet row per user.
CREATE TABLE IF NOT EXISTS game_user_wallet (
  user_id        uuid PRIMARY KEY REFERENCES sys_user(id),
  tanga          bigint NOT NULL DEFAULT 0,   -- persistent, never expires
  xp             bigint NOT NULL DEFAULT 0,   -- current window only
  xp_date        date,                        -- the day the current xp was earned for
  last_reward_at timestamp,                   -- activity up to here is already rewarded
  updated_at     timestamp NOT NULL DEFAULT now()
);

-- Market catalogue.
CREATE TABLE IF NOT EXISTS market_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(60) UNIQUE NOT NULL,
  title       varchar(120) NOT NULL,
  description text,
  price_tanga bigint NOT NULL DEFAULT 0,
  category    varchar(40),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- Purchase ledger.
CREATE TABLE IF NOT EXISTS market_purchase (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES sys_user(id),
  item_id       uuid NOT NULL REFERENCES market_item(id),
  price_tanga   bigint NOT NULL,   -- tanga actually paid (after XP discount)
  xp_spent      bigint NOT NULL DEFAULT 0,
  purchased_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_purchase_user ON market_purchase (user_id);

-- A few starter items (idempotent).
INSERT INTO market_item (code, title, description, price_tanga, category) VALUES
  ('color_neon_pack', 'Neon Color Pack', 'Unlock neon territory colors',      5000,  'cosmetic'),
  ('boost_2x_day',    '2x XP Boost (1 day)', 'Double XP for 24 hours',         3000,  'boost'),
  ('streak_freeze',   'Streak Freeze', 'Protect your streak for one missed day', 2000, 'utility'),
  ('challenge_card',  'Challenge Card', 'One free challenge against a friend',  1500,  'challenge')
ON CONFLICT (code) DO NOTHING;
