-- Add Custom Order Service columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_tier VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preferred_contact VARCHAR(30);

-- Add item_url and variation_image to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_url TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variation_image TEXT;
