-- Settlement ledger entries for full-payment incentive splits (platform + optional reporter).

CREATE TABLE IF NOT EXISTS settlement_ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('platform', 'reporter', 'landlord')),
    beneficiary_id TEXT,
    amount_ngn BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    rationale TEXT NOT NULL,
    split_config_version TEXT NOT NULL,
    split_config_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS settlement_ledger_entries_dedup_uidx
    ON settlement_ledger_entries (deal_id, event_type, beneficiary_type, COALESCE(beneficiary_id, ''));

CREATE INDEX IF NOT EXISTS settlement_ledger_entries_deal_idx
    ON settlement_ledger_entries (deal_id, created_at);
