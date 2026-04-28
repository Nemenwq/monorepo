-- Landlord Property Inventory Management
CREATE TABLE IF NOT EXISTS landlord_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    area TEXT,
    bedrooms INTEGER NOT NULL CHECK (bedrooms >= 0),
    bathrooms INTEGER NOT NULL CHECK (bathrooms >= 0),
    sqm NUMERIC(10,2) CHECK (sqm > 0),
    annual_rent_ngn NUMERIC(20,2) NOT NULL CHECK (annual_rent_ngn > 0),
    description TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
    views INTEGER NOT NULL DEFAULT 0,
    inquiries INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT landlord_properties_photos_must_be_array CHECK (jsonb_typeof(photos) = 'array')
);

CREATE INDEX IF NOT EXISTS landlord_properties_landlord_id_idx ON landlord_properties (landlord_id);
CREATE INDEX IF NOT EXISTS landlord_properties_status_idx ON landlord_properties (status);
CREATE INDEX IF NOT EXISTS landlord_properties_created_at_idx ON landlord_properties (created_at DESC);
CREATE INDEX IF NOT EXISTS landlord_properties_search_idx ON landlord_properties
    USING GIN (to_tsvector('english', title || ' ' || address || ' ' || coalesce(city,'') || ' ' || coalesce(area,'') || ' ' || coalesce(description,'')));
