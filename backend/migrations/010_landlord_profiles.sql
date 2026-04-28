-- Migration to add landlord profiles, settings, and notification preferences
-- Addresses issue #592

CREATE TABLE IF NOT EXISTS landlord_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    address TEXT,
    company_name TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    notification_preferences JSONB NOT NULL DEFAULT '{
        "newInquiries": true,
        "paymentUpdates": true,
        "propertyViews": false,
        "marketingTips": false
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS landlord_profiles_user_id_idx ON landlord_profiles (user_id);

-- Comments for documentation
COMMENT ON TABLE landlord_profiles IS 'Detailed profile and preference data for users with the landlord role';
COMMENT ON COLUMN landlord_profiles.notification_preferences IS 'JSONB object storing various notification toggle states';
