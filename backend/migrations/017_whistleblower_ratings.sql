-- Tenant → Whistleblower ratings and review text (public trust signal)

CREATE TABLE IF NOT EXISTS whistleblower_ratings (
  rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whistleblower_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  deal_id UUID NOT NULL REFERENCES tenant_deals(deal_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate submissions per completed rental
  CONSTRAINT whistleblower_ratings_unique_per_deal UNIQUE (deal_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS whistleblower_ratings_whistleblower_id_idx
  ON whistleblower_ratings (whistleblower_id);

CREATE INDEX IF NOT EXISTS whistleblower_ratings_created_at_idx
  ON whistleblower_ratings (created_at DESC);

