import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';

import { Cart } from './entities/cart.entity';
import { ICartItem } from './types/types';
import { Product } from '../product/entities/product.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { PaystackService } from 'src/common/services/paystack.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,

    private readonly paystackService: PaystackService,
  ) {}

  /* ────────────────────────────────────────────────
     REMOVE PRODUCT FROM ALL CARTS (GLOBAL CLEANUP)
     Called when a product is deleted
  ──────────────────────────────────────────────── */
  async removeProductFromAllCartsAndReturnUserIds(
    productId: string,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Cart) : this.cartRepo;

    const carts = await repo
      .createQueryBuilder('cart')
      .where(`cart.cart_items @> :item`, {
        item: JSON.stringify([{ product_id: productId }]),
      })
      .getMany();

    if (!carts.length) return [];

    const userIds = new Set<string>();

    for (const cart of carts) {
      if (cart.user_id) {
        userIds.add(cart.user_id);
      }
      cart.cart_items = cart.cart_items.filter(
        (item) => item.product_id !== productId,
      );
    }

    await repo.save(carts);
    return Array.from(userIds);
  }

  /* ────────────────────────────────────────────────
     INTERNAL HELPERS
  ──────────────────────────────────────────────── */

  private async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { user_id: userId },
    });

    if (!cart) {
      cart = this.cartRepo.create({
        user_id: userId,
        cart_items: [],
      });

      cart = await this.cartRepo.save(cart);
    }

    return cart;
  }

  private calculateTotals(cartItems: ICartItem[]) {
    let subtotalKobo = 0;
    const vendorShippingFees: Record<string, number> = {};

    for (const item of cartItems) {
      const priceKobo = item.unit_price;
      subtotalKobo += priceKobo * item.quantity;

      // Group by vendor and take the maximum shipping cost for that vendor
      const itemShippingKobo = Number(item.shipping_cost || 0);
      if (
        !vendorShippingFees[item.vendor_id] ||
        itemShippingKobo > vendorShippingFees[item.vendor_id]
      ) {
        vendorShippingFees[item.vendor_id] = itemShippingKobo;
      }
    }

    const totalShippingKobo = Object.values(vendorShippingFees).reduce(
      (sum, fee) => sum + fee,
      0,
    );

    /*
     * FEE MODEL v2 — Buyer Side (mirrors order-creation.service.ts)
     * ─────────────────────────────────────────────────────────────
     * Buyer pays: subtotal + shipping + 1% platform fee (capped at ₦2,000).
     * Paystack transaction fee is borne by the vendor via bearer_type: 'subaccount'
     * (deducted automatically from vendor's split — NOT added to buyer's total).
     * ─────────────────────────────────────────────────────────────
     */
    const BUYER_FEE_RATE = 0.01;
    const BUYER_FEE_CAP_KOBO = 200_000; // ₦2,000 cap

    const rawBuyerFeeKobo = Math.round(subtotalKobo * BUYER_FEE_RATE);
    const buyerPlatformFeeKobo = Math.min(rawBuyerFeeKobo, BUYER_FEE_CAP_KOBO);

    // Buyer total: subtotal + shipping + their 1% fee only
    // Paystack fee is taken from vendor's side — not charged to buyer
    const serviceChargeKobo = buyerPlatformFeeKobo;
    const totalKobo = subtotalKobo + totalShippingKobo + buyerPlatformFeeKobo;

    return {
      subtotalKobo,
      shippingKobo: totalShippingKobo,
      serviceChargeKobo,
      totalKobo,
    };
  }

  /* ────────────────────────────────────────────────
     GET CART
  ──────────────────────────────────────────────── */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const totals = this.calculateTotals(cart.cart_items);

    return {
      message: 'Cart retrieved successfully',
      cart: {
        id: cart.id,
        items: cart.cart_items.map((item) => ({
          ...item,
          price: Number(item.price) / 100,
          discount_price: item.discount_price
            ? Number(item.discount_price) / 100
            : null,
          shipping_cost: item.shipping_cost
            ? Number(item.shipping_cost) / 100
            : null,
        })),
        subtotal: totals.subtotalKobo / 100,
        shipping: totals.shippingKobo / 100,
        platform_fee: totals.serviceChargeKobo / 100,
        total: totals.totalKobo / 100,
      },
    };
  }

  /* ────────────────────────────────────────────────
     ADD ITEM TO CART
  ──────────────────────────────────────────────── */
  async addItem(
    userId: string,
    payload: {
      product_id: string;
      quantity: number;
      size?: string | null;
      color?: string | null;
      variant_id?: string | null;
    },
  ) {
    if (payload.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    const product = await this.productRepo.findOne({
      where: { id: payload.product_id },
      relations: ['variants'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < payload.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const cart = await this.getOrCreateCart(userId);

    const existing = cart.cart_items.find(
      (i) =>
        i.product_id === product.id &&
        (i.variant_id ?? null) === (payload.variant_id ?? null) &&
        (i.size ?? null) === (payload.size ?? null) &&
        (i.color ?? null) === (payload.color ?? null),
    );

    if (existing) {
      existing.quantity += payload.quantity;
      // Refresh prices to current state
      let activePrice = Number(product.price);
      let activeDiscount =
        product.on_sale && product.discount_price
          ? Number(product.discount_price)
          : null;
      if (payload.variant_id && product.variants?.length) {
        const variant = product.variants.find(
          (v) => v.id === payload.variant_id,
        );
        if (variant) {
          activePrice = Number(variant.price);
          activeDiscount =
            product.on_sale && variant.discount_price
              ? Number(variant.discount_price)
              : null;
        }
      }
      existing.price = activePrice;
      existing.discount_price = activeDiscount;
      existing.unit_price = activeDiscount ?? activePrice;
    } else {
      // Resolve color name if ID provided
      let colorDisplay = payload.color ?? null;
      let colorHex: string | null = null;

      if (payload.color && /^[0-9a-f]{8}-/.test(payload.color)) {
        const colorEntity = await this.colorRepo.findOne({
          where: { id: payload.color },
        });
        if (colorEntity) {
          colorDisplay = colorEntity.name;
          colorHex = colorEntity.hex;
        }
      }

      let activePrice = Number(product.price);
      let activeDiscount =
        product.on_sale && product.discount_price
          ? Number(product.discount_price)
          : null;
      let activeStock = product.stock;
      let variantOptions: Record<string, string> | null = null;
      let activeImage = product.image?.url ?? null;

      if (payload.variant_id && product.variants?.length) {
        const variant = product.variants.find(
          (v) => v.id === payload.variant_id,
        );
        if (variant) {
          activePrice = Number(variant.price);
          activeDiscount =
            product.on_sale && variant.discount_price
              ? Number(variant.discount_price)
              : null;
          activeStock = variant.stock;
          variantOptions = variant.combinations;
          if (variant.image_url) activeImage = variant.image_url;
        }
      }

      if (activeStock < payload.quantity) {
        throw new BadRequestException(
          'Insufficient stock for selected variant',
        );
      }

      const item: ICartItem = {
        product_id: product.id,
        vendor_id: product.vendor_id,
        name: product.name,
        slug: product.slug,
        price: activePrice,
        discount_price: activeDiscount,
        unit_price: activeDiscount ?? activePrice, // resolved effective price in kobo
        image: activeImage,
        quantity: payload.quantity,
        variant_id: payload.variant_id ?? null,
        variant_options: variantOptions,
        size: payload.size ?? null,
        color: colorDisplay,
        color_hex: colorHex,
        shipping_cost: product.shipping_cost
          ? Number(product.shipping_cost)
          : null,
      };

      cart.cart_items.push(item);
    }

    await this.cartRepo.save(cart);

    return this.getCart(userId);
  }

  /* ────────────────────────────────────────────────
     UPDATE ITEM (QTY / VARIANT)
  ──────────────────────────────────────────────── */
  async updateItem(
    userId: string,
    productId: string,
    payload: {
      quantity?: number;
      size?: string | null;
      color?: string | null;
      variant_id?: string | null;
    },
  ) {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.cart_items.find(
      (i) =>
        i.product_id === productId &&
        (i.variant_id ?? null) === (payload.variant_id ?? null) &&
        (i.size ?? null) === (payload.size ?? null) &&
        (i.color ?? null) === (payload.color ?? null),
    );

    if (!item) {
      throw new NotFoundException('Item variant not found in cart');
    }

    if (payload.quantity !== undefined) {
      if (payload.quantity < 1) {
        throw new BadRequestException('Quantity must be at least 1');
      }

      const product = await this.productRepo.findOne({
        where: { id: productId },
        relations: ['variants'],
        select: ['id', 'stock'],
      });

      let stock = product?.stock ?? 0;
      if (payload.variant_id && product?.variants?.length) {
        const v = product.variants.find((v) => v.id === payload.variant_id);
        if (v) stock = v.stock;
      }

      if (!product || stock < payload.quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      item.quantity = payload.quantity;
    }

    if (payload.size !== undefined) item.size = payload.size;
    if (payload.color !== undefined) item.color = payload.color;

    await this.cartRepo.save(cart);

    return this.getCart(userId);
  }

  /* ────────────────────────────────────────────────
     REMOVE ITEM
  ──────────────────────────────────────────────── */
  async removeItem(
    userId: string,
    productId: string,
    size?: string | null,
    color?: string | null,
    variantId?: string | null,
  ) {
    const cart = await this.getOrCreateCart(userId);

    cart.cart_items = cart.cart_items.filter(
      (i) =>
        !(
          i.product_id === productId &&
          (i.variant_id ?? null) === (variantId ?? null) &&
          (i.size ?? null) === (size ?? null) &&
          (i.color ?? null) === (color ?? null)
        ),
    );

    await this.cartRepo.save(cart);

    return this.getCart(userId);
  }

  /* ────────────────────────────────────────────────
     CLEAR CART
  ──────────────────────────────────────────────── */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    cart.cart_items = [];

    await this.cartRepo.save(cart);

    return {
      message: 'Cart cleared successfully',
      cart: {
        items: [],
        subtotal: 0,
        shipping: 0,
        total: 0,
      },
    };
  }
}
