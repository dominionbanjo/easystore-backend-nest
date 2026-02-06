# Order and Delivery Entity Relationship Fixes

## Summary

Fixed the relationship between Order and Delivery entities to be a proper OneToOne relationship, and updated the vendor orders query to include delivery information.

## Changes Made

### 1. **Delivery Entity** (`delivery.entity.ts`)

- ✅ Changed `@ManyToOne` to `@OneToOne` for the Order relationship
- ✅ Added `unique: true` constraint to `order_id` column
- ✅ Updated comments to clarify that Delivery is the owning side

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
@Column({ type: 'uuid', nullable: true, unique: true })
order_id: string | null;

@OneToOne(() => Order, (order) => order.delivery, {
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
})
@JoinColumn({ name: 'order_id' })
order: Order | null;
```

### 2. **Order Query Service** (`order-query.service.ts`)

- ✅ Updated `getOrdersByVendor` to include delivery relation
- ✅ Added explicit select fields for both order and delivery
- ✅ Added ordering by `created_at DESC`

**Before:**

```typescript
async getOrdersByVendor(vendor_id: string) {
  return this.orderRepo.find({ where: { vendor_id } });
}
```

**After:**

```typescript
async getOrdersByVendor(vendor_id: string) {
  return this.orderRepo.find({
    where: { vendor_id },
    relations: ['delivery'],
    select: {
      id: true,
      buyer_id: true,
      vendor_id: true,
      order_items: true,
      subtotal: true,
      shipping_fee: true,
      tax: true,
      total: true,
      payment_method: true,
      payment_reference: true,
      payment_status: true,
      status: true,
      created_at: true,
      updated_at: true,
      delivery: {
        id: true,
        delivery_status: true,
        tracking_number: true,
        estimated_delivery: true,
        delivered_at: true,
      },
    },
    order: {
      created_at: 'DESC',
    },
  });
}
```

### 3. **Database Migration**

Created migration: `1707241800000-AddUniqueConstraintToDeliveryOrderId.ts`

- ✅ Adds unique constraint to `deliveries.order_id`
- ✅ Ensures database schema matches entity definitions

## Relationship Structure

### OneToOne Relationship

```
Order (1) ←──→ (1) Delivery
         ↑
         └── Delivery owns the relationship (has order_id FK)
```

### Constraints

- **Order Entity**: Has `@OneToOne` decorator without `@JoinColumn` (non-owning side)
- **Delivery Entity**: Has `@OneToOne` decorator with `@JoinColumn` (owning side)
- **Database**: `deliveries.order_id` has UNIQUE constraint
- **Cascade Rules**:
  - `onDelete: 'SET NULL'` - If order is deleted, delivery.order_id becomes null
  - `onUpdate: 'CASCADE'` - If order.id changes, delivery.order_id updates

## API Response Format

The vendor orders endpoint now returns:

```json
[
  {
    "id": "uuid",
    "buyer_id": "uuid",
    "vendor_id": "uuid",
    "order_items": [...],
    "subtotal": 100.00,
    "shipping_fee": 0.00,
    "tax": null,
    "total": 100.00,
    "payment_method": "online",
    "payment_reference": "ref_123",
    "payment_status": "success",
    "status": "paid",
    "created_at": "2026-02-06T...",
    "updated_at": "2026-02-06T...",
    "delivery": {
      "id": "uuid",
      "delivery_status": "pending",
      "tracking_number": null,
      "estimated_delivery": null,
      "delivered_at": null
    }
  }
]
```

## Frontend Impact

The OrdersPage frontend can now access delivery information:

```typescript
// In orderColumns.tsx
{
  accessorKey: "delivery.delivery_status",
  header: () => <div className="text-center">Delivery</div>,
  cell: ({ row }) => {
    const delivery = row.original.delivery;
    // delivery object is now available with all fields
  }
}
```

## Migration Instructions

To apply the database changes:

```bash
npm run migration:run
```

To rollback if needed:

```bash
npm run migration:revert
```

## Benefits

1. **Data Integrity**: Unique constraint ensures one delivery per order
2. **Type Safety**: Proper OneToOne relationship in TypeORM
3. **Frontend Ready**: Delivery status now available in vendor orders API
4. **Performance**: Explicit select reduces data transfer
5. **Maintainability**: Clear relationship structure
