import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(StoreStaff)
    private readonly storeStaffRepo: Repository<StoreStaff>,
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
      relations: ['buyer', 'vendor', 'vendor.stores'],
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
          stores: {
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
      relations: ['delivery', 'vendor', 'vendor.stores', 'delivery_address', 'escrow'],
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
          stores: {
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
    qb.leftJoinAndSelect('vendor.stores', 'store');

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
    store_id?: string,
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
    if (store_id) {
      qb.andWhere('order.store_id = :store_id', { store_id });
    }

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

  /* ────────────────────────────────────────────────
     GET SALES HISTORY (OFFLINE SALES)
     Filtered by vendor, paginated, staff-attributed
  ──────────────────────────────────────────────── */
  async getSalesHistory(
    vendorId: string,
    storeId?: string,
    query: {
      page?: number;
      limit?: number;
      staffId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo.createQueryBuilder('order');
    qb.leftJoinAndSelect('order.recordedByUser', 'staff');
    qb.where('order.vendor_id = :vendorId', { vendorId });
    if (storeId) {
      qb.andWhere('order.store_id = :storeId', { storeId });
    }
    qb.andWhere("order.payment_method IN ('cash', 'transfer', 'pos', 'offline')")
      .andWhere("order.status = 'completed'");

    qb.select([
      'order.id',
      'order.order_items',
      'order.subtotal',
      'order.total',
      'order.payment_method',
      'order.payment_status',
      'order.status',
      'order.notes',
      'order.recorded_by',
      'order.created_at',
      'staff.id',
      'staff.first_name',
      'staff.last_name',
    ]);

    if (query.staffId) {
      qb.andWhere('order.recorded_by = :staffId', { staffId: query.staffId });
    }

    if (query.dateFrom) {
      qb.andWhere('order.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      const endDate = new Date(query.dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      qb.andWhere('order.created_at <= :dateTo', {
        dateTo: endDate,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(order.notes ILIKE :search OR CAST(order.id AS TEXT) ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    const items = data.map((order) => {
      return {
        id: order.id,
        items: order.order_items,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        notes: order.notes,
        recorded_by: order.recorded_by,
        staff_name: order.recordedByUser
          ? `${order.recordedByUser.first_name ?? ''} ${order.recordedByUser.last_name ?? ''}`.trim()
          : null,
        created_at: order.created_at,
      };
    });

    return buildPagination(items, total, page, limit);
  }

  /* ────────────────────────────────────────────────
     GET RECEIPT DATA FOR PRINTING
     Returns formatted receipt data for an order
  ──────────────────────────────────────────────── */
  async getReceiptData(orderId: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['recordedByUser', 'vendor', 'store'],
      select: {
        id: true,
        store_id: true,
        order_items: true,
        subtotal: true,
        shipping_fee: true,
        platform_fee: true,
        tax: true,
        total: true,
        payment_method: true,
        payment_status: true,
        status: true,
        notes: true,
        recorded_by: true,
        created_at: true,
        recordedByUser: {
          id: true,
          first_name: true,
          last_name: true,
        },
        vendor: {
          id: true,
          first_name: true,
          last_name: true,
        },
        store: {
          id: true,
          store_name: true,
          slug: true,
          logo: true,
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.vendor_id !== userId && order.recorded_by !== userId) {
      const storeId = order.store?.id ?? order.store_id;
      if (!storeId) throw new NotFoundException('Order not found');
      const isStoreStaff = await this.storeStaffRepo.findOne({
        where: { user_id: userId, store_id: storeId, status: 'active' },
        select: { id: true },
      });
      if (!isStoreStaff) throw new NotFoundException('Order not found');
    }

    const idPrefix = order.id.split('-')[0].toUpperCase();

    return {
      id: order.id,
      order_reference: `#${idPrefix}`,
      store_name: order.store?.store_name ?? 'Store',
      store_logo: order.store?.logo ?? null,
      items: order.order_items,
      subtotal: Number(order.subtotal),
      shipping_fee: Number(order.shipping_fee),
      tax: Number(order.tax),
      total: Number(order.total),
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      status: order.status,
      staff_name: order.recordedByUser
        ? `${order.recordedByUser.first_name} ${order.recordedByUser.last_name}`
        : null,
      notes: order.notes,
      created_at: order.created_at,
    };
  }
}
