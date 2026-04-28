-- Migration: Payment Disputes
-- Adds table for tenant payment disputes

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('amount_discrepancy', 'duplicate_charge', 'service_not_received', 'early_termination', 'property_issue', 'other')),
  description TEXT NOT NULL,
  evidence_keys TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'rejected')),
  resolution TEXT,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_user_id ON payment_disputes(user_id);
CREATE INDEX idx_disputes_payment_id ON payment_disputes(payment_id);
CREATE INDEX idx_disputes_status ON payment_disputes(status);
CREATE INDEX idx_disputes_created_at ON payment_disputes(created_at DESC);

COMMENT ON TABLE payment_disputes IS 'Tenant payment disputes with evidence';