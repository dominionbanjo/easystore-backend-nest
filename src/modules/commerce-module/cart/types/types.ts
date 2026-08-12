export interface ICartItem {
  product_id: string;
  vendor_id: string;
  /** ⭐ Store that owns the product. Authoritative store-scoped grouping key. */
  store_id: string | null;
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
  /** Whether the product's vendor has enabled installment purchase (set at validation). */
  installment_enabled?: boolean;
  /** Vendor-offered installment presets for this product (set at validation). */
  installment_presets?: string[];
}
