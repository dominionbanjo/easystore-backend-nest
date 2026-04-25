export interface ICartItem {
  product_id: string;
  vendor_id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  /** ⭐ Authoritative resolved price in kobo. Set ONCE at validation. Never recalculate. */
  unit_price: number;
  image: string | null;
  variant_id?: string | null;
  variant_options?: Record<string, string> | null;
  quantity: number;
  size: string | null;
  color: string | null;
  color_hex?: string | null;
}
