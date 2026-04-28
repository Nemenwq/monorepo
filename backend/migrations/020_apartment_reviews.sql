-- Apartment Reviews Table
-- Stores user-submitted reviews for apartments (landlord properties)
CREATE TABLE IF NOT EXISTS apartment_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL REFERENCES landlord_properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    verified_stay BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_reported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and filtering
CREATE INDEX IF NOT EXISTS apartment_reviews_apartment_id_idx ON apartment_reviews (apartment_id);
CREATE INDEX IF NOT EXISTS apartment_reviews_rating_idx ON apartment_reviews (rating);
CREATE INDEX IF NOT EXISTS apartment_reviews_created_at_idx ON apartment_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS apartment_reviews_verified_stay_idx ON apartment_reviews (verified_stay);
CREATE INDEX IF NOT EXISTS apartment_reviews_visibility_idx ON apartment_reviews (is_hidden, is_reported);

-- Comment for documentation
COMMENT ON TABLE apartment_reviews IS 'User-submitted reviews and ratings for apartments';
COMMENT ON COLUMN apartment_reviews.rating IS 'Numerical rating from 1 to 5 stars';
COMMENT ON COLUMN apartment_reviews.verified_stay IS 'Flag indicating if the reviewer has a confirmed rental history at this apartment';
COMMENT ON COLUMN apartment_reviews.is_hidden IS 'Administrative flag to hide inappropriate content';
COMMENT ON COLUMN apartment_reviews.is_reported IS 'User-facing flag to mark a review for moderation';
