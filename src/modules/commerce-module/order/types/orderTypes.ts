import { ICartItem } from '../../cart/types/types';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'canceled';

export type PaymentStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'unpaid';

export interface IOrder {
  id: string;
  buyer_id: string;
  vendor_id: string;
  escrow_id: string | null;
  delivery_id: string | null;

  subtotal: number;
  shipping_fee: number;
  tax: number | null;
  total: number;

  payment_method: 'online' | 'offline';
  payment_reference: string | null;
  payment_url: string | null;
  payment_access_code: string | null;
  payment_status: PaymentStatus | null;

  status: OrderStatus;
  notes: string | null;

  order_items: ICartItem[];

  created_at: string | null;
  updated_at: string | null;
}
