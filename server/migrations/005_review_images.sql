-- ============================================================
-- MIGRATION: Review Images (Phase 5)
-- ============================================================

-- 1. Add image_url to reviews
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
