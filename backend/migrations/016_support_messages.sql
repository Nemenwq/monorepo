-- Public support/contact form submissions
-- Stores anonymous inbound messages for later support handling.

CREATE TABLE IF NOT EXISTS support_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_created_at_idx
  ON support_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_email_idx
  ON support_messages (email);

