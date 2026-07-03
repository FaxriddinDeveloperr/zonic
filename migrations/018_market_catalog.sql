-- Market: richer catalog + inventory support (BACKEND_TODO §4). Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/018_market_catalog.sql

ALTER TABLE market_item ADD COLUMN IF NOT EXISTS currency       varchar(10)  NOT NULL DEFAULT 'tanga'; -- tanga | uzs
ALTER TABLE market_item ADD COLUMN IF NOT EXISTS is_premium     boolean      NOT NULL DEFAULT false;
ALTER TABLE market_item ADD COLUMN IF NOT EXISTS duration       varchar(20)  NOT NULL DEFAULT 'permanent'; -- permanent|1h|1d|1m|3m
ALTER TABLE market_item ADD COLUMN IF NOT EXISTS discount_label varchar(60);

-- Starter catalog (frames / themes / boosters / challenge / premium). The mobile team can send
-- their full item list to extend this seed.
INSERT INTO market_item (code, title, description, price_tanga, category, currency, is_premium, duration) VALUES
  ('frame_gold',   'Oltin Ramka',  'Avatar uchun oltin ramka',   5000, 'frame',     'tanga', false, 'permanent'),
  ('frame_neon',   'Neon Ramka',   'Neon avatar ramkasi',        3000, 'frame',     'tanga', false, 'permanent'),
  ('theme_dark',   'Tungi Tema',   'Qorongʻu interfeys temasi',  2000, 'theme',     'tanga', false, 'permanent'),
  ('booster_xp_2x','2x XP Booster','24 soat davomida 2x XP',     1500, 'booster',   'tanga', false, '1d'),
  ('premium_gold_month',    'Gold Obuna (1 oy)',  'Gold tarifi',   15000, 'premium', 'uzs', true, '1m'),
  ('premium_goldplus_month','Gold+ Obuna (1 oy)', 'Gold+ tarifi',  30000, 'premium', 'uzs', true, '1m')
ON CONFLICT (code) DO NOTHING;
