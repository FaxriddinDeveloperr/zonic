-- Challenge Tickets: a Market item required to CREATE a challenge. Single-use tickets are consumed
-- on use (consumed_at); time-based tickets stay valid until their duration expires (not consumed).
-- Prices are placeholders — confirm them with the app before launch. Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/031_challenge_tickets.sql

-- Consumption marker for single-use purchases (tickets). NULL = still available.
ALTER TABLE market_purchase ADD COLUMN IF NOT EXISTS consumed_at timestamp;

-- Ticket catalog. duration: 'single' (one use) | '1d' | '1m' | '3m'. category = 'challenge'.
INSERT INTO market_item (code, title, description, price_tanga, category, currency, is_premium, duration)
VALUES
  ('ch_single',       'Chorlov kartasi (1 martalik)', '1 ta bellashuv yaratish',        1000,  'challenge', 'tanga', false, 'single'),
  ('ch_day',          'Chorlov kartasi (1 kun)',      '1 kun cheksiz bellashuv',        3000,  'challenge', 'tanga', false, '1d'),
  ('ch_month',        'Chorlov kartasi (1 oy)',       '1 oy cheksiz bellashuv',         15000, 'challenge', 'tanga', true,  '1m'),
  ('ch_3month',       'Chorlov kartasi (3 oy)',       '3 oy cheksiz bellashuv',         35000, 'challenge', 'tanga', true,  '3m'),
  ('ch_team_single',  'Jamoa chorlovi (1 martalik)',  '1 ta jamoa bellashuvi',          2000,  'challenge', 'tanga', false, 'single'),
  ('ch_team_day',     'Jamoa chorlovi (1 kun)',       '1 kun cheksiz jamoa bellashuvi', 5000,  'challenge', 'tanga', false, '1d'),
  ('ch_team_month',   'Jamoa chorlovi (1 oy)',        '1 oy cheksiz jamoa bellashuvi',  25000, 'challenge', 'tanga', true,  '1m'),
  ('ch_team_3month',  'Jamoa chorlovi (3 oy)',        '3 oy cheksiz jamoa bellashuvi',  60000, 'challenge', 'tanga', true,  '3m')
ON CONFLICT (code) DO NOTHING;
