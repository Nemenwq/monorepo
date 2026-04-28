-- Migration: KYC Document Tables
-- Adds tables for KYC document submission, verification, and status lifecycle

CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('drivers_license', 'passport', 'national_id', 'voters_card')),
  front_image_key TEXT NOT NULL,
  back_image_key TEXT,
  liveness_signal TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  provider_id VARCHAR(100),
  external_id VARCHAR(255),
  rejection_reason TEXT,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id)
);

CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_status ON kyc_documents(status);
CREATE INDEX idx_kyc_created_at ON kyc_documents(created_at DESC);

COMMENT ON TABLE kyc_documents IS 'KYC document submissions with encrypted image references';
COMMENT ON COLUMN kyc_documents.front_image_key IS 'Encrypted S3 key for front image';
COMMENT ON COLUMN kyc_documents.back_image_key IS 'Encrypted S3 key for back image';
COMMENT ON COLUMN kyc_documents.status IS 'KYC verification status lifecycle';