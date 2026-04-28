-- Durable idempotency for payment initiation and other mutating APIs.
-- Replays return cached JSON; concurrent duplicate keys get 409 while processing (or reclaim after lease).

CREATE TABLE IF NOT EXISTS api_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_body_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    http_status INT,
    response_body JSONB,
    processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS api_idempotency_scope_key_uidx
    ON api_idempotency (scope, idempotency_key);

CREATE INDEX IF NOT EXISTS api_idempotency_status_expires_idx
    ON api_idempotency (status, expires_at);
