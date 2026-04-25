-- Public application intake tables
-- Partner landlord applications and whistleblower signup applications

CREATE TABLE IF NOT EXISTS partner_landlord_applications (
  id TEXT PRIMARY KEY DEFAULT ('PLA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  property_count INTEGER NOT NULL CHECK (property_count > 0),
  property_locations TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_landlord_applications_created_at
  ON partner_landlord_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_landlord_applications_status
  ON partner_landlord_applications(status);

CREATE TABLE IF NOT EXISTS whistleblower_signup_applications (
  id TEXT PRIMARY KEY DEFAULT ('WSA-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  linkedin_profile TEXT NOT NULL,
  facebook_profile TEXT NOT NULL,
  instagram_profile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whistleblower_signup_applications_created_at
  ON whistleblower_signup_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whistleblower_signup_applications_status
  ON whistleblower_signup_applications(status);
