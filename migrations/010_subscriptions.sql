-- Subscription tier per user (Phase M). Tier definitions/features live in code
-- (src/common/subscription-tiers.ts); this table just stores each user's current tier + expiry.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/010_subscriptions.sql

CREATE TABLE IF NOT EXISTS game_subscription (
  user_id    uuid PRIMARY KEY REFERENCES sys_user(id),
  tier       varchar(20) NOT NULL DEFAULT 'free',   -- 'free' | 'gold' | 'gold_plus'
  expires_at timestamp,                              -- null for free / non-expiring
  updated_at timestamp NOT NULL DEFAULT now()
);
