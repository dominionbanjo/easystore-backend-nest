import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cart } from './entities/cart.entity';
import { Product } from 'src/product/entities/product.entity';
import { ICartItem } from './types/types';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

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
    let subtotal = 0;
    let shipping = 0;

    for (const item of cartItems) {
      const price = item.discount_price ?? item.price;
      subtotal += price * item.quantity;
      shipping += item.shipping_cost ?? 0;
    }

    return {
      subtotal,
      shipping,
      total: subtotal + shipping,
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
        items: cart.cart_items,
        ...totals,
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
        i.size === (payload.size ?? null) &&
        i.color === (payload.color ?? null),
    );

    if (existing) {
      existing.quantity += payload.quantity;
    } else {
      const item: ICartItem = {
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        discount_price: product.discount_price
          ? Number(product.discount_price)
          : null,
        image: product.image?.url ?? null,
        quantity: payload.quantity,
        size: payload.size ?? null,
        color: payload.color ?? null,
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

    const item = cart.cart_items.find((i) => i.product_id === productId);

    if (!item) {
      throw new NotFoundException('Item not found in cart');
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
  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);

    cart.cart_items = cart.cart_items.filter((i) => i.product_id !== productId);

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
