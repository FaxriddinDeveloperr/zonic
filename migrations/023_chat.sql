-- 1:1 chat: a conversation per unique user pair + messages. Safe to run more than once.
--   psql -U postgres -d zonic -f migrations/023_chat.sql

CREATE TABLE IF NOT EXISTS game_chat_conversation (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid NOT NULL REFERENCES sys_user(id),   -- always the smaller uuid of the pair
  user_b     uuid NOT NULL REFERENCES sys_user(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversation_pair ON game_chat_conversation (user_a, user_b);

CREATE TABLE IF NOT EXISTS game_chat_message (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    uuid NOT NULL REFERENCES game_chat_conversation(id),
  sender_id          uuid NOT NULL REFERENCES sys_user(id),
  recipient_id       uuid NOT NULL REFERENCES sys_user(id),
  text               text,
  attachment_file_id varchar(200),
  attachment_type    varchar(20),                      -- 'image' | 'file' | null
  sent_at            timestamp NOT NULL DEFAULT now(),
  is_read            boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_chat_msg_conv   ON game_chat_message (conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS ix_chat_msg_unread ON game_chat_message (recipient_id, is_read);
