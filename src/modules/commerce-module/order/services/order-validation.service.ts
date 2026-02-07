import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductService } from '../../product/services/product.service';
import { ICartItem } from '../../cart/types/types';

@Injectable()
export class OrderValidationService {
  constructor(private readonly productService: ProductService) {}

  /* ────────────────────────────────────────────────
     VALIDATE & BUILD ORDER ITEMS
  ──────────────────────────────────────────────── */
  async buildOrderItems(order_items: ICartItem[], buyer_id?: string) {
    if (!order_items || order_items.length === 0) {
      throw new BadRequestException('Order items are required');
    }

    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of order_items) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.product_id}`);
      }

      // 🚫 Prevent self-ordering
      if (buyer_id && product.vendor_id === buyer_id) {
        throw new BadRequestException(
          `You cannot purchase your own product: ${product.name}`,
        );
      }

      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new BadRequestException(
          `${product.name} is out of stock or less than order quantity, Update cart`,
        );
      }

      const price =
        product.on_sale && product.discount_price
          ? Number(product.discount_price)
          : Number(product.price);
      subtotal += price * item.quantity;

      validated.push({
        product_id: product.id,
        vendor_id: product.vendor_id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        discount_price: product.on_sale ? Number(product.discount_price) : null,
        image: product.image?.url ?? null,
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        shipping_cost: product.shipping_cost
          ? Number(product.shipping_cost)
          : null,
      });
    }

    return { validatedItems: validated, subtotal };
  }

  /* ────────────────────────────────────────────────
     GROUP ITEMS BY VENDOR
  ──────────────────────────────────────────────── */
  async groupItemsByVendor(
    items: ICartItem[],
  ): Promise<Record<string, ICartItem[]>> {
    const groups: Record<string, ICartItem[]> = {};

    for (const item of items) {
      const { product } = await this.productService.getSingle(item.product_id);
      if (!groups[product.vendor_id]) {
        groups[product.vendor_id] = [];
      }
      groups[product.vendor_id].push(item);
    }

    return groups;
  }
}
