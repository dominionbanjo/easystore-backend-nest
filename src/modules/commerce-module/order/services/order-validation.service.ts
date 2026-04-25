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

      /* ─── Variant-aware stock & price resolution ─── */
      let activePrice: number;
      let activeDiscountPrice: number | null;
      let activeStock: number;
      let activeImage: string | null = product.image?.url ?? null;
      let variantOptions: Record<string, string> | null = null;

      // 🔍 Identify variant: try by ID first, then fallback to combinations (size/color)
      let variant: any = null;
      if (item.variant_id && product.variants?.length) {
        variant = product.variants.find((v) => v.id === item.variant_id);
      }

      // 🛠️ Fallback: search by combinations (size/color) if ID is missing or no match found
      if (!variant && product.variants?.length && (item.size || item.color)) {
        variant = product.variants.find((v) => {
          const combos = v.combinations || {};
          // Standardize comparison for robustness against key casing
          let matched = true;

          if (item.size) {
            const sizeKey = Object.keys(combos).find(
              (k) => k.toLowerCase() === 'size',
            );
            if (
              !sizeKey ||
              combos[sizeKey]?.toString().toLowerCase() !==
                item.size.toLowerCase()
            ) {
              matched = false;
            }
          }

          if (matched && item.color) {
            const colorKey = Object.keys(combos).find(
              (k) => k.toLowerCase() === 'color',
            );
            if (
              !colorKey ||
              combos[colorKey]?.toString().toLowerCase() !==
                item.color.toLowerCase()
            ) {
              matched = false;
            }
          }

          return matched;
        });
      }

      if (variant) {
        activePrice = Number(variant.price);
        activeDiscountPrice =
          product.on_sale && variant.discount_price
            ? Number(variant.discount_price)
            : null;
        activeStock = variant.stock;
        variantOptions = variant.combinations ?? null;

        if (variant.image_url) {
          activeImage = variant.image_url;
        }
      } else {
        // No variant – use product-level price/stock
        activePrice = Number(product.price);
        activeDiscountPrice =
          product.on_sale && product.discount_price
            ? Number(product.discount_price)
            : null;
        activeStock = product.stock;
      }

      /* ─── Stock check ─── */
      if (activeStock < 1 || item.quantity > activeStock) {
        throw new BadRequestException(
          `"${product.name}" ${variant ? `(${Object.values(variantOptions || {}).join(', ')})` : ''} is out of stock or quantity exceeds available stock (${activeStock < 0 ? 0 : activeStock}). Please update your cart.`,
        );
      }

      const unitPrice = Number(activeDiscountPrice ?? activePrice);
      subtotal += unitPrice * item.quantity;

      validated.push({
        product_id: product.id,
        vendor_id: product.vendor_id,
        name: product.name,
        slug: product.slug,
        price: activePrice,
        discount_price: activeDiscountPrice,
        unit_price: unitPrice, // ⭐ single source of truth — never recalculate
        image: activeImage,
        quantity: item.quantity,
        // variant fields
        variant_id: (variant?.id as string) || (item.variant_id ?? null),
        variant_options: variantOptions || item.variant_options || null,
        // legacy size / color (kept for backward compat)
        size: item.size ?? null,
        color: item.color ?? null,
        color_hex: item.color_hex ?? null,
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
      const vendorId = item.vendor_id;
      if (!vendorId) continue;
      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }
      groups[vendorId].push(item);
    }

    return groups;
  }
}
