-- Deduplicate payment webhooks by provider event identity (in addition to business ref idempotency).
-- Same provider_event_id may only be processed once per rail; replays return 200 without side effects.

CREATE TABLE IF NOT EXISTS webhook_event_dedupe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rail TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_event_dedupe_rail_event_uidx
    ON webhook_event_dedupe (rail, provider_event_id);

CREATE INDEX IF NOT EXISTS webhook_event_dedupe_created_at_idx
    ON webhook_event_dedupe (created_at);
