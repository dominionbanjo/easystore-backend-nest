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
      select: {
        id: true,
        buyer_id: true,
        vendor_id: true,
        status: true,
        payment_status: true,
        total: true,
        order_items: true,
        created_at: true,
        buyer: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
        vendor: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    });
  }

  /* ────────────────────────────────────────────────
     GET SINGLE ORDER
  ──────────────────────────────────────────────── */
  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: {
        id: true,
        buyer_id: true,
        vendor_id: true,
        status: true,
        payment_status: true,
        payment_method: true,
        payment_reference: true,
        subtotal: true,
        shipping_fee: true,
        platform_fee: true,
        tax: true,
        total: true,
        order_items: true,
        notes: true,
        created_at: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /* ────────────────────────────────────────────────
   GET ORDER FOR RECEIPT
  ──────────────────────────────────────────────── */
  async getOrderForReceipt(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['buyer', 'vendor', 'vendor.store'],
      select: {
        id: true,
        buyer_id: true,
        vendor_id: true,
        status: true,
        payment_status: true,
        payment_method: true,
        payment_reference: true,
        subtotal: true,
        shipping_fee: true,
        platform_fee: true,
        tax: true,
        total: true,
        order_items: true,
        created_at: true,
        buyer: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
        vendor: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          store: {
            id: true,
            store_name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /* ────────────────────────────────────────────────
     GET ORDER FOR API (WITH RELATIONS)
  ──────────────────────────────────────────────── */
  async getOrderForApi(id: string, user_id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['delivery', 'vendor', 'vendor.store', 'delivery_address', 'escrow'],
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
          confirmation_code: true,
        },
        escrow: {
          id: true,
          status: true,
          release_code: true,
        },
        delivery_address: {
          id: true,
          street: true,
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
          store: {
            id: true,
            store_name: true,
            slug: true,
            logo: true,
            phone_number: true,
            address_street: true,
            address_city: true,
            address_state: true,
          },
        },
        id: true,
        buyer_id: true,
        vendor_id: true,
        status: true,
        payment_status: true,
        created_at: true,
        subtotal: true,
        shipping_fee: true,
        platform_fee: true,
        tax: true,
        total: true,
        order_items: true,
        notes: true,
        payment_method: true,
        payment_reference: true,
        payment_url: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Check if the user is the buyer or vendor of this order
    if (order.buyer_id !== user_id && order.vendor_id !== user_id) {
      throw new NotFoundException('Order not found');
    }

    // 🔒 SECURITY: Only the buyer should see the delivery confirmation code
    if (order.vendor_id === user_id) {
      if (order.delivery) order.delivery.confirmation_code = null;
      if (order.escrow) order.escrow.release_code = null;

      // 💰 FINANCIAL: Vendors only see their net payout (Total - Platform Fee)
      // We overwrite the total field so the frontend doesn't need complex math
      const platformFee = Number(order.platform_fee || 0);
      order.total = Number(order.total) - platformFee;
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

    // Join delivery relation
    qb.leftJoinAndSelect('order.delivery', 'delivery');
    qb.leftJoinAndSelect('order.vendor', 'vendor');
    qb.leftJoinAndSelect('vendor.store', 'store');

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
      'order.order_items',
      'delivery.id',
      'delivery.delivery_status',
      'delivery.tracking_number',
      'delivery.estimated_delivery',
      'delivery.delivered_at',
      'vendor.id',
      'vendor.first_name',
      'vendor.last_name',
      'store.id',
      'store.store_name',
      'store.slug',
      'store.logo',
    ]);

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

    // Join relations
    qb.leftJoinAndSelect('order.delivery', 'delivery');
    qb.leftJoinAndSelect('order.buyer', 'buyer');
    qb.leftJoinAndSelect('order.delivery_address', 'delivery_address');

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
        '(CAST(order.id AS TEXT) ILIKE :search OR order.payment_reference ILIKE :search OR buyer.first_name ILIKE :search OR buyer.last_name ILIKE :search)',
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
      'delivery.address',
      'delivery.city',
      'delivery.state',
      'delivery.country',
      'delivery.postal_code',
      'delivery_address.id',
      'delivery_address.street',
      'delivery_address.city',
      'delivery_address.state',
      'delivery_address.country',
      'delivery_address.postal_code',
      'buyer.id',
      'buyer.first_name',
      'buyer.last_name',
      'buyer.email',
      'buyer.phone_number',
      'buyer.avatar',
    ]);

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // 💰 FINANCIAL: Map orders to exclude platform fee for vendor view
    const vendorData = data.map((order) => {
      const platformFee = Number(order.platform_fee || 0);
      return {
        ...order,
        total: Number(order.total) - platformFee,
      };
    });

    return buildPagination(vendorData, total, page, limit);
  }
}
