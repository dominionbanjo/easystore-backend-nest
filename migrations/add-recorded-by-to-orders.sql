-- Add recorded_by column to orders table for staff attribution
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for querying sales by staff member
CREATE INDEX IF NOT EXISTS idx_orders_recorded_by ON orders(recorded_by);
