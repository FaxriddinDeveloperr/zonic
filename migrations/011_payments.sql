-- Payments (Phase L). Provider-agnostic ledger. Real Click/Payme/Uzum integration needs each
-- provider's merchant credentials + signed webhooks (marked in PaymentService); this stores the
-- payment lifecycle and, on confirmation of a 'subscription:*' purpose, activates the tier.
-- Safe to run more than once:
--   psql -U postgres -d zonic -f migrations/011_payments.sql

CREATE TABLE IF NOT EXISTS game_payment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES sys_user(id),
  provider    varchar(20) NOT NULL,                 -- 'click' | 'payme' | 'uzum' | 'mock'
  amount      bigint NOT NULL,
  currency    varchar(8) NOT NULL DEFAULT 'UZS',
  purpose     varchar(60) NOT NULL,                 -- e.g. 'subscription:gold'
  status      varchar(20) NOT NULL DEFAULT 'created', -- created | paid | failed
  external_id varchar(100),                         -- provider invoice id
  created_at  timestamp NOT NULL DEFAULT now(),
  paid_at     timestamp
);

CREATE INDEX IF NOT EXISTS idx_payment_user        ON game_payment (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_external_id ON game_payment (external_id);
