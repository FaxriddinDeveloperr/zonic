-- Weekly Tanga expiry: coins belong to a week (the local Monday they were earned in) and are
-- burned when a new week starts. tanga_week holds that Monday; a mismatch with the current week
-- means the balance has expired. Backfills existing wallets to the current week (nothing burns now).
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/028_tanga_weekly.sql

ALTER TABLE game_user_wallet ADD COLUMN IF NOT EXISTS tanga_week date;

-- Current local (UTC+5) Monday — same rule the app uses.
UPDATE game_user_wallet
   SET tanga_week = (date_trunc('week', (now() AT TIME ZONE 'Asia/Tashkent')))::date
 WHERE tanga_week IS NULL;
