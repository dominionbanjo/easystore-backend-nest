# Order-Delivery Relationship Fix

## Overview

Fixed the Order-Delivery relationship to use proper OneToOne relationship with foreign key constraints and cascade rules.

## Problem

- Orders and Deliveries had a circular dependency (both had FKs to each other)
- No proper unique constraint on the relationship
- Missing CASCADE delete behavior
- Paid orders were not showing delivery information

## Solution

### 1. Entity Changes

#### Order Entity (`order.entity.ts`)

**Before:**

```typescript
@Column({ type: 'uuid', nullable: true })
delivery_id: string | null;

@ManyToOne(() => Delivery, (delivery) => delivery.order, {
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
})
@JoinColumn({ name: 'delivery_id' })
delivery: Delivery | null;
```

**After:**

```typescript
@OneToOne(() => Delivery, (delivery) => delivery.order, {
  nullable: true,
})
delivery: Delivery | null;
```

#### Delivery Entity (`delivery.entity.ts`)

**Before:**

```typescript
@Column({ type: 'uuid', nullable: true })
order_id: string | null;

@ManyToOne(() => Order, (order) => order.delivery, {
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
})
@JoinColumn({ name: 'order_id' })
order: Order | null;
```

**After:**

```typescript
@Column({ type: 'uuid', nullable: false, unique: true })
@Index('IDX_DELIVERY_ORDER_ID')
order_id: string;

@OneToOne(() => Order, (order) => order.delivery, {
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
})
@JoinColumn({ name: 'order_id' })
order: Order;
```

### 2. Database Schema Changes

The SQL migration script (`fix-order-delivery-relationship.sql`) performs:

1. **Removes `delivery_id` column from `orders` table**
   - No longer needed as relationship is managed through `deliveries.order_id`

2. **Makes `deliveries.order_id` UNIQUE and NOT NULL**
   - Enforces OneToOne relationship at database level
   - Prevents orphaned deliveries

3. **Adds CASCADE foreign key constraint**

   ```sql
   ALTER TABLE deliveries
     ADD CONSTRAINT FK_DELIVERY_ORDER
     FOREIGN KEY (order_id)
     REFERENCES orders(id)
     ON DELETE CASCADE
     ON UPDATE CASCADE;
   ```

4. **Creates deliveries for existing paid orders**
   - Automatically generates delivery records for paid orders without deliveries
   - Uses buyer's address from user profile

5. **Adds performance index**
   ```sql
   CREATE INDEX IDX_DELIVERY_ORDER_ID ON deliveries(order_id);
   ```

### 3. Service Code Changes

Removed code that tried to update `order.delivery_id` since it no longer exists:

**Files Updated:**

- `order.service.ts` (verifyPayment method)
- `order.service.ts` (createOnlineOrderNoEscrow method)
- `order-payment-webhook.service.ts` (handlePaystackWebhook method)

**Before:**

```typescript
const delivery = await this.deliveryService.createDelivery({...});
await manager.update(Order, order.id, {
  delivery_id: delivery.id,  // ❌ This field no longer exists
});
```

**After:**

```typescript
await this.deliveryService.createDelivery({...});
// Relationship is automatically established through delivery.order_id
```

## Relationship Diagram

```
┌─────────────────┐                    ┌──────────────────┐
│     orders      │                    │    deliveries    │
├─────────────────┤                    ├──────────────────┤
│ id (PK)         │◄───────────────────│ order_id (FK)    │
│ buyer_id        │    OneToOne        │ (UNIQUE, NOT NULL)│
│ vendor_id       │    CASCADE DELETE  │                  │
│ total           │                    │ delivery_status  │
│ payment_status  │                    │ tracking_number  │
│ status          │                    │ address          │
└─────────────────┘                    └──────────────────┘
```

## Cascade Behavior

### When Order is Deleted:

- ✅ Associated Delivery is **automatically deleted** (CASCADE)
- ✅ No orphaned delivery records

### When Delivery is Deleted:

- ✅ Order remains intact
- ✅ Order.delivery relation becomes null

## Running the Migration

### Step 1: Backup Database

```bash
pg_dump -U postgres -d easystore > backup_before_migration.sql
```

### Step 2: Run Migration

```bash
psql -U postgres -d easystore -f migrations/fix-order-delivery-relationship.sql
```

### Step 3: Verify Results

The script includes verification queries that will show:

- Count of orders with deliveries
- Count of paid orders without deliveries (should be 0)

### Step 4: Restart Backend

```bash
npm run dev
```

## Testing

### Test 1: Create New Order

1. Create a new order
2. Complete payment
3. Verify delivery is created automatically
4. Check that `order.delivery` relation works

### Test 2: Fetch Order with Delivery

```typescript
const order = await orderRepo.findOne({
  where: { id: orderId },
  relations: ['delivery'],
});
// order.delivery should contain delivery info
```

### Test 3: Delete Order

1. Delete an order
2. Verify associated delivery is also deleted (CASCADE)

## Rollback

If you need to rollback, uncomment and run the rollback section in the SQL file:

```sql
-- Remove the unique constraint
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS UQ_DELIVERY_ORDER_ID;

-- Make order_id nullable again
ALTER TABLE deliveries ALTER COLUMN order_id DROP NOT NULL;

-- Add back delivery_id column to orders
ALTER TABLE orders ADD COLUMN delivery_id UUID NULL;

-- Update orders with their delivery_id
UPDATE orders o
SET delivery_id = d.id
FROM deliveries d
WHERE d.order_id = o.id;

-- Add foreign key for delivery_id
ALTER TABLE orders
  ADD CONSTRAINT FK_ORDER_DELIVERY
  FOREIGN KEY (delivery_id)
  REFERENCES deliveries(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

## Benefits

1. **Data Integrity**
   - OneToOne relationship enforced at database level
   - No orphaned deliveries
   - Automatic cleanup with CASCADE delete

2. **Simpler Code**
   - No need to manually update `delivery_id`
   - Relationship managed automatically by TypeORM

3. **Better Performance**
   - Index on `deliveries.order_id`
   - Efficient joins

4. **Consistency**
   - All paid orders have deliveries
   - Clear ownership (Delivery owns the FK)

## Files Changed

### Backend Entities:

- ✅ `order.entity.ts` - Updated to OneToOne, removed delivery_id
- ✅ `delivery.entity.ts` - Updated to OneToOne with JoinColumn

### Backend Services:

- ✅ `order.service.ts` - Removed delivery_id updates
- ✅ `order-payment-webhook.service.ts` - Removed delivery_id updates

### Migration:

- ✅ `migrations/fix-order-delivery-relationship.sql` - Database migration script

### Frontend:

- ✅ No changes needed - API response structure remains the same
