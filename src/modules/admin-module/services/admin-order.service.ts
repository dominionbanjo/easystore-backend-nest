import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { buildPagination } from 'src/utils/response/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class AdminOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getAllOrders(
    query: PaginationQueryDto & {
      status?: string;
      search?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo.createQueryBuilder('order');
    qb.leftJoin('order.buyer', 'buyer');
    qb.leftJoin('order.vendor', 'vendor');
    qb.leftJoin('vendor.stores', 'store');

    qb.select([
      'order.id',
      'order.buyer_id',
      'order.vendor_id',
      'order.total',
      'order.status',
      'order.payment_status',
      'order.created_at',
      'buyer.id',
      'buyer.first_name',
      'buyer.last_name',
      'buyer.email',
      'vendor.id',
      'vendor.first_name',
      'vendor.last_name',
      'vendor.email',
      'store.id',
      'store.store_name',
    ]);

    if (query.status && query.status !== 'all') {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    const search = query.search || query.q;
    if (search) {
      qb.andWhere(
        '(CAST(order.id AS TEXT) ILIKE :search OR order.payment_reference ILIKE :search OR buyer.first_name ILIKE :search OR buyer.last_name ILIKE :search OR store.store_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('order.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      message: 'Orders retrieved successfully',
      data: buildPagination(data, total, page, limit),
    };
  }

  async getOne(id: string) {
    const order = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.buyer', 'buyer')
      .leftJoin('order.vendor', 'vendor')
      .leftJoin('vendor.store', 'store')
      .leftJoin('order.delivery', 'delivery')
      .leftJoin('order.delivery_address', 'delivery_address')
      .where('order.id = :id', { id })
      .select([
        'order.id',
        'order.buyer_id',
        'order.vendor_id',
        'order.subtotal',
        'order.shipping_fee',
        'order.platform_fee',
        'order.tax',
        'order.total',
        'order.status',
        'order.payment_status',
        'order.payment_method',
        'order.payment_reference',
        'order.payment_url',
        'order.order_items',
        'order.notes',
        'order.analytics_processed',
        'order.confirmed',
        'order.created_at',
        'buyer.id',
        'buyer.first_name',
        'buyer.last_name',
        'buyer.email',
        'buyer.phone_number',
        'buyer.avatar',
        'vendor.id',
        'vendor.first_name',
        'vendor.last_name',
        'vendor.email',
        'store.id',
        'store.store_name',
        'store.slug',
        'store.logo',
        'delivery.id',
        'delivery.delivery_status',
        'delivery.tracking_number',
        'delivery.estimated_delivery',
        'delivery.delivered_at',
        'delivery.confirmation_code',
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
      ])
      .getOne();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      message: 'Order retrieved successfully',
      data: order,
    };
  }
}
