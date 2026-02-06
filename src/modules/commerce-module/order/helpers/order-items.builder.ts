import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { ICartItem } from '../../cart/types/types';

@Injectable()
export class OrderItemsBuilder {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async build(items: ICartItem[]) {
    if (!items.length) {
      throw new BadRequestException('Order items are required');
    }

    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of items) {
      const product = await this.productRepo.findOne({
        where: { id: item.product_id },
      });

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.product_id}`);
      }

      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new BadRequestException(`Invalid quantity for ${product.name}`);
      }

      const price = product.discount_price ?? product.price;
      subtotal += price * item.quantity;

      validated.push({
        product_id: product.id,
        vendor_id: product.vendor_id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        discount_price: product.discount_price
          ? Number(product.discount_price)
          : null,
        image: product.image?.url ?? null,
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        shipping_cost: product.shipping_cost
          ? Number(product.shipping_cost)
          : null,
      });
    }

    return { items: validated, subtotal };
  }
}
