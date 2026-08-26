-- ============================================================
-- MIGRATION: Coupons, Quests & Reviews
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── COUPONS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
    coupon_id       SERIAL PRIMARY KEY,
    coupon_code     VARCHAR(50) UNIQUE NOT NULL,
    description     TEXT,
    discount_type   VARCHAR(10) NOT NULL DEFAULT 'percent',
    discount_value  DECIMAL(10,2) NOT NULL,
    min_spent       DECIMAL(10,2) DEFAULT 0,
    max_discount    DECIMAL(10,2),
    max_uses_total  INT,
    max_uses_per_user INT DEFAULT 1,
    times_used      INT DEFAULT 0,
    starts_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_categories (
    coupon_id   INT REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, category_id)
);

CREATE TABLE IF NOT EXISTS coupon_claims (
    claim_id    SERIAL PRIMARY KEY,
    coupon_id   INT REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    user_id     INT REFERENCES users(user_id) ON DELETE CASCADE,
    claimed_at  TIMESTAMPTZ DEFAULT NOW(),
    used_at     TIMESTAMPTZ,
    order_id    INT REFERENCES orders(order_id) ON DELETE SET NULL,
    order_total DECIMAL(10,2),
    saved_amount DECIMAL(10,2)
);

-- ── QUESTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quests (
    quest_id        SERIAL PRIMARY KEY,
    quest_name      VARCHAR(200) NOT NULL,
    description     TEXT,
    quest_type      VARCHAR(50) NOT NULL,
    target_value    INT DEFAULT 1,
    reward_type     VARCHAR(20) DEFAULT 'coupon',
    reward_coupon_id INT REFERENCES coupons(coupon_id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT true,
    starts_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_progress (
    progress_id     SERIAL PRIMARY KEY,
    quest_id        INT REFERENCES quests(quest_id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(user_id) ON DELETE CASCADE,
    current_value   INT DEFAULT 0,
    completed       BOOLEAN DEFAULT false,
    completed_at    TIMESTAMPTZ,
    reward_claimed  BOOLEAN DEFAULT false,
    UNIQUE(quest_id, user_id)
);

-- ── REVIEWS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
    review_id       SERIAL PRIMARY KEY,
    product_id      INT REFERENCES products(product_id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(user_id) ON DELETE CASCADE,
    rating          INT CHECK (rating BETWEEN 1 AND 5),
    review_text     TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    admin_note      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS review_products (
    review_id   INT REFERENCES reviews(review_id) ON DELETE CASCADE,
    product_id  INT REFERENCES products(product_id) ON DELETE CASCADE,
    PRIMARY KEY (review_id, product_id)
);
