-- Migration to add stock snapshot columns to request_items
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS "stock_before" INT;
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS "stock_after" INT;

-- Update existing records with current stock as a fallback (optional)
-- UPDATE request_items ri SET stock_after = (SELECT quantity FROM items WHERE id = ri.item_id) WHERE stock_after IS NULL;
