-- Friends / Clan (Phase G): a unique numeric ZONIC-ID per user + a friendship table.
-- Search is by ZONIC-ID only (nicknames aren't unique). Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/008_friends.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS zonic_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_user_zonic_id ON sys_user (zonic_id) WHERE zonic_id IS NOT NULL;

-- Backfill existing users with a unique 6-digit id.
DO $$
DECLARE r RECORD; newid integer;
BEGIN
  FOR r IN SELECT id FROM sys_user WHERE zonic_id IS NULL LOOP
    LOOP
      newid := 100000 + floor(random() * 900000)::int;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM sys_user WHERE zonic_id = newid);
    END LOOP;
    UPDATE sys_user SET zonic_id = newid WHERE id = r.id;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS game_friendship (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES sys_user(id),
  addressee_id uuid NOT NULL REFERENCES sys_user(id),
  status       varchar(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted'
  created_at   timestamp NOT NULL DEFAULT now(),
  responded_at timestamp,
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendship_requester ON game_friendship (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendship_addressee ON game_friendship (addressee_id);
