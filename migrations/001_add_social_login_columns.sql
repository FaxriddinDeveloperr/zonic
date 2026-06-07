-- Social login (Google / Apple) — add the columns that link a local account to a provider.
-- Safe to run more than once. Run on the server before deploying the social-login build:
--   psql -U postgres -d zonic -f migrations/001_add_social_login_columns.sql

ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS google_user_id varchar;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS apple_user_id  varchar;

-- One local account per provider identity (partial unique — many users may have NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_user_google_user_id
  ON sys_user (google_user_id) WHERE google_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_user_apple_user_id
  ON sys_user (apple_user_id) WHERE apple_user_id IS NOT NULL;
