-- Backfill a unique 6-digit ZONIC-ID for every user missing one, so they're friend-requestable
-- from search / leaderboards / the map (previously zonic_id was assigned lazily on first Friends/Me).
-- Safe to run more than once (only touches NULLs):
--   psql -U postgres -d zonic -f migrations/021_backfill_zonic_id.sql

DO $$
DECLARE
  r RECORD;
  cand int;
BEGIN
  FOR r IN SELECT id FROM sys_user WHERE zonic_id IS NULL LOOP
    LOOP
      cand := 100000 + floor(random() * 900000)::int;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM sys_user WHERE zonic_id = cand);
    END LOOP;
    UPDATE sys_user SET zonic_id = cand WHERE id = r.id;
  END LOOP;
END $$;
