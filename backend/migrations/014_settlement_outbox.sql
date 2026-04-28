-- Outbox for rent settlement side effects (receipt, notifications, audit). Emitted in same transaction as schedule updates when a period is marked paid.

CREATE TABLE IF NOT EXISTS settlement_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    period INT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'done', 'failed', 'dead')),
    attempts INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS settlement_outbox_idem_uidx
    ON settlement_outbox (idempotency_key);

CREATE INDEX IF NOT EXISTS settlement_outbox_pending_idx
    ON settlement_outbox (status, next_retry_at, created_at);

CREATE TABLE IF NOT EXISTS settlement_outbox_dlq (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL,
    period INT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    last_error TEXT,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS settlement_outbox_dlq_deal_idx ON settlement_outbox_dlq (deal_id);
