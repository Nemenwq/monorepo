-- Tenant Applications Table
-- Stores tenant property financing applications

CREATE TABLE IF NOT EXISTS tenant_applications (
  id TEXT PRIMARY KEY DEFAULT ('APP-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT),
  user_id TEXT NOT NULL,
  property_id INTEGER NOT NULL,
  property_title TEXT,
  property_location TEXT,
  annual_rent NUMERIC(15, 2) NOT NULL CHECK (annual_rent > 0),
  deposit NUMERIC(15, 2) NOT NULL CHECK (deposit > 0),
  duration INTEGER NOT NULL CHECK (duration > 0 AND duration <= 24),
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
  monthly_payment NUMERIC(15, 2) NOT NULL CHECK (monthly_payment >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  has_agreed_to_terms BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  rejection_reason TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tenant_applications_user_id ON tenant_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_status ON tenant_applications(status);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_created_at ON tenant_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_user_status ON tenant_applications(user_id, status);

-- Comments
COMMENT ON TABLE tenant_applications IS 'Tenant property financing applications';
COMMENT ON COLUMN tenant_applications.id IS 'Unique application identifier';
COMMENT ON COLUMN tenant_applications.user_id IS 'User who submitted the application';
COMMENT ON COLUMN tenant_applications.property_id IS 'Property ID from listing';
COMMENT ON COLUMN tenant_applications.annual_rent IS 'Annual rent amount in NGN';
COMMENT ON COLUMN tenant_applications.deposit IS 'Deposit amount in NGN (minimum 20% of annual rent)';
COMMENT ON COLUMN tenant_applications.duration IS 'Financing duration in months';
COMMENT ON COLUMN tenant_applications.total_amount IS 'Total amount to finance (annual_rent - deposit)';
COMMENT ON COLUMN tenant_applications.monthly_payment IS 'Monthly payment amount';
COMMENT ON COLUMN tenant_applications.status IS 'Application status: pending, approved, rejected, cancelled';
COMMENT ON COLUMN tenant_applications.has_agreed_to_terms IS 'Whether user agreed to terms and conditions';
