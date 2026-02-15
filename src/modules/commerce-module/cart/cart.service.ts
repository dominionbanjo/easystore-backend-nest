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
      const priceKobo = item.discount_price ?? item.price;
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

    // Platform fee (Fixed 2%)
    const platformFee2PercentKobo = Math.round(subtotalKobo * 0.02);

    // Base amount that we apply Paystack fee on
    const baseAmountBeforePaystack =
      subtotalKobo + totalShippingKobo + platformFee2PercentKobo;

    // Calculate Paystack fee on the base amount
    const paystackFeeKobo = this.paystackService.calculateTransactionFee(
      baseAmountBeforePaystack,
    );

    // Consolidate both fees into "Service Charge"
    const serviceChargeKobo = platformFee2PercentKobo + paystackFeeKobo;

    const totalKobo = baseAmountBeforePaystack + paystackFeeKobo;

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
    },
  ) {
    if (payload.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    const product = await this.productRepo.findOne({
      where: { id: payload.product_id },
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
        (i.size ?? null) === (payload.size ?? null) &&
        (i.color ?? null) === (payload.color ?? null),
    );

    if (existing) {
      existing.quantity += payload.quantity;
      // Refresh prices to current state
      existing.price = Number(product.price);
      existing.discount_price =
        product.on_sale && product.discount_price
          ? Number(product.discount_price)
          : null;
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

      const item: ICartItem = {
        product_id: product.id,
        vendor_id: product.vendor_id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        discount_price:
          product.on_sale && product.discount_price
            ? Number(product.discount_price)
            : null,
        image: product.image?.url ?? null,
        quantity: payload.quantity,
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
    },
  ) {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.cart_items.find(
      (i) =>
        i.product_id === productId &&
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
        select: ['stock'],
      });

      if (!product || product.stock < payload.quantity) {
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
  ) {
    const cart = await this.getOrCreateCart(userId);

    cart.cart_items = cart.cart_items.filter(
      (i) =>
        !(
          i.product_id === productId &&
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
