-- ============================================================================
-- MIGRATION: Fix Order-Delivery Relationship
-- Description: Update database schema to properly link orders and deliveries
--              using OneToOne relationship with proper foreign keys
-- ============================================================================

-- Step 1: Drop the old delivery_id column from orders table (if it exists)
-- This column is no longer needed as the relationship is managed through deliveries.order_id
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_id;

-- Step 2: Make deliveries.order_id NOT NULL and UNIQUE for OneToOne relationship
-- First, delete any deliveries without an order_id
DELETE FROM deliveries WHERE order_id IS NULL;

-- Now make the column NOT NULL and UNIQUE
ALTER TABLE deliveries 
  ALTER COLUMN order_id SET NOT NULL,
  ADD CONSTRAINT UQ_DELIVERY_ORDER_ID UNIQUE (order_id);

-- Step 3: Add proper foreign key constraint with CASCADE
-- Drop existing foreign key if it exists
ALTER TABLE deliveries 
  DROP CONSTRAINT IF EXISTS FK_DELIVERY_ORDER;

-- Add new foreign key with CASCADE delete
ALTER TABLE deliveries
  ADD CONSTRAINT FK_DELIVERY_ORDER 
  FOREIGN KEY (order_id) 
  REFERENCES orders(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS IDX_DELIVERY_ORDER_ID ON deliveries(order_id);

-- Step 5: Update existing paid orders without deliveries
-- This will create delivery records for any paid orders that don't have one
INSERT INTO deliveries (
  id,
  order_id,
  buyer_id,
  vendor_id,
  delivery_status,
  address,
  city,
  state,
  country,
  postal_code,
  order_items,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() as id,
  o.id as order_id,
  o.buyer_id,
  o.vendor_id,
  'pending' as delivery_status,
  u.address->>'street' as address,
  u.address->>'city' as city,
  u.address->>'state' as state,
  u.address->>'country' as country,
  u.address->>'postal_code' as postal_code,
  o.order_items,
  NOW() as created_at,
  NOW() as updated_at
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
LEFT JOIN users u ON u.id = o.buyer_id
WHERE d.id IS NULL 
  AND o.payment_status = 'success'
  AND o.status IN ('paid', 'processing', 'in_transit', 'delivered', 'completed');

-- Step 6: Verify the migration
-- Count orders with deliveries
SELECT 
  'Orders with deliveries' as description,
  COUNT(*) as count
FROM orders o
INNER JOIN deliveries d ON d.order_id = o.id;

-- Count paid orders without deliveries (should be 0)
SELECT 
  'Paid orders without deliveries' as description,
  COUNT(*) as count
FROM orders o
LEFT JOIN deliveries d ON d.order_id = o.id
WHERE d.id IS NULL 
  AND o.payment_status = 'success';

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- Uncomment and run if you need to rollback this migration

-- -- Remove the unique constraint
-- ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS UQ_DELIVERY_ORDER_ID;
-- 
-- -- Make order_id nullable again
-- ALTER TABLE deliveries ALTER COLUMN order_id DROP NOT NULL;
-- 
-- -- Add back delivery_id column to orders
-- ALTER TABLE orders ADD COLUMN delivery_id UUID NULL;
-- 
-- -- Update orders with their delivery_id
-- UPDATE orders o
-- SET delivery_id = d.id
-- FROM deliveries d
-- WHERE d.order_id = o.id;
-- 
-- -- Add foreign key for delivery_id
-- ALTER TABLE orders
--   ADD CONSTRAINT FK_ORDER_DELIVERY 
--   FOREIGN KEY (delivery_id) 
--   REFERENCES deliveries(id) 
--   ON DELETE SET NULL 
--   ON UPDATE CASCADE;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
