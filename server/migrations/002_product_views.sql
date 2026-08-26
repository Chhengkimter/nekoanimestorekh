-- ============================================================
-- MIGRATION: Product Views Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS product_views (
    view_id         SERIAL PRIMARY KEY,
    product_id      INT REFERENCES products(product_id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(user_id) ON DELETE SET NULL, -- Null if guest
    ip_address      VARCHAR(45), -- Useful for anonymous tracking/preventing spam
    viewed_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index to quickly count views per product
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
