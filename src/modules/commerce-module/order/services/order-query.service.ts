import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /* ────────────────────────────────────────────────
     GET ORDERS BY PAYMENT REFERENCE
  ──────────────────────────────────────────────── */
  async getOrdersByPaymentReference(reference: string) {
    return this.orderRepo.find({
      where: { payment_reference: reference },
      relations: ['buyer', 'vendor'],
    });
  }

  /* ────────────────────────────────────────────────
     GET SINGLE ORDER
  ──────────────────────────────────────────────── */
  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /* ────────────────────────────────────────────────
     GET ORDER FOR API (WITH RELATIONS)
  ──────────────────────────────────────────────── */
  async getOrderForApi(id: string, user_id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['delivery', 'vendor'],
      select: {
        delivery: {
          id: true,
          delivery_status: true,
          tracking_number: true,
          estimated_delivery: true,
          delivered_at: true,
          address: true,
          city: true,
          state: true,
          country: true,
          postal_code: true,
        },
        vendor: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
        },
        id: true,
        buyer_id: true,
        status: true,
        payment_status: true,
        created_at: true,
        subtotal: true,
        shipping_fee: true,
        platform_fee: true,
        tax: true,
        total: true,
        order_items: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Check if the user is the buyer of this order
    if (order.buyer_id !== user_id) {
      throw new NotFoundException('Order not found');
    }

    return {
      status: 'success',
      message: 'Order retrieved successfully',
      data: order,
    };
  }

  /* ────────────────────────────────────────────────
     GET ORDERS BY USER (BUYER)
  ──────────────────────────────────────────────── */
  async getOrdersByUser(
    buyer_id: string,
    query?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo.createQueryBuilder('order');

    qb.where('order.buyer_id = :buyer_id', { buyer_id });

    if (query?.status && query.status !== 'all') {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(CAST(order.id AS TEXT) ILIKE :search OR order.payment_reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Optimize selection for card display
    qb.select([
      'order.id',
      'order.subtotal',
      'order.shipping_fee',
      'order.platform_fee',
      'order.total',
      'order.status',
      'order.payment_status',
      'order.payment_reference',
      'order.created_at',
      'order.order_items', // JSONB column
      'delivery.id',
      'delivery.delivery_status',
      'delivery.tracking_number',
      'delivery.estimated_delivery',
      'delivery.delivered_at',
    ]);

    // Join delivery relation
    qb.leftJoinAndSelect('order.delivery', 'delivery');

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return buildPagination(data, total, page, limit);
  }

  /* ────────────────────────────────────────────────
     GET ORDERS BY VENDOR
  ──────────────────────────────────────────────── */
  async getOrdersByVendor(
    vendor_id: string,
    query?: { search?: string; status?: string; page?: number; limit?: number },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo.createQueryBuilder('order');

    // Join delivery relation early to allow filtering
    qb.leftJoinAndSelect('order.delivery', 'delivery');

    qb.where('order.vendor_id = :vendor_id', { vendor_id });

    // Status filter - check both order status and delivery status
    if (query?.status && query.status !== 'all') {
      qb.andWhere(
        '(order.status = :status OR delivery.delivery_status = :status)',
        { status: query.status },
      );
    }

    // Search filter (by order ID or payment reference)
    if (query?.search) {
      qb.andWhere(
        '(CAST(order.id AS TEXT) ILIKE :search OR order.payment_reference ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Select specific fields
    qb.select([
      'order.id',
      'order.buyer_id',
      'order.vendor_id',
      'order.order_items',
      'order.subtotal',
      'order.shipping_fee',
      'order.platform_fee',
      'order.tax',
      'order.total',
      'order.payment_method',
      'order.payment_reference',
      'order.payment_status',
      'order.status',
      'order.created_at',
      'order.updated_at',
      'delivery.id',
      'delivery.delivery_status',
      'delivery.tracking_number',
      'delivery.estimated_delivery',
      'delivery.delivered_at',
    ]);

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return buildPagination(data, total, page, limit);
  }
}
