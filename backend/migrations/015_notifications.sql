-- In-app notifications (transaction, listing, application events).

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    read_at TIMESTAMPTZ,
    dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
    ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
    ON user_notifications (user_id) WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedupe_uidx
    ON user_notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
