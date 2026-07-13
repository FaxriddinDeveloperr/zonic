-- Avatar frames sold in the Market. Without these rows Purchase returns 400 "Item not found",
-- so the coins were never actually taken (they "came back") and nothing landed in the inventory.
-- The app must read prices from GET /Market/Items — the server is the source of truth.
-- Safe to run more than once (existing codes are left untouched):
--   psql -U postgres -d zonic -f migrations/030_frames_catalog.sql

INSERT INTO market_item (code, title, description, price_tanga, category, currency, is_premium, duration)
VALUES
  ('frame_minimal', 'Minimal Ramka', 'Sodda, toza ramka',        1000, 'frame', 'tanga', false, 'permanent'),
  ('frame_pixel',   'Pixel Ramka',   'Piksel uslubidagi ramka',  1500, 'frame', 'tanga', false, 'permanent'),
  ('frame_tech',    'Tech Ramka',    'Texnologik ramka',         2000, 'frame', 'tanga', false, 'permanent'),
  ('frame_sport',   'Sport Ramka',   'Sport uslubidagi ramka',   2500, 'frame', 'tanga', false, 'permanent'),
  ('frame_pulse',   'Pulse Ramka',   'Puls animatsiyali ramka',  3500, 'frame', 'tanga', false, 'permanent'),
  ('b2',            'B2 Ramka',      'B2 ramka',                 2000, 'frame', 'tanga', false, 'permanent'),
  ('b3',            'B3 Ramka',      'B3 ramka',                 4000, 'frame', 'tanga', false, 'permanent')
ON CONFLICT (code) DO NOTHING;
