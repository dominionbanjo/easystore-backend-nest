export interface ICartItem {
  product_id: string;
  vendor_id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  image: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  color_hex?: string | null;
  shipping_cost: number | null;
}
