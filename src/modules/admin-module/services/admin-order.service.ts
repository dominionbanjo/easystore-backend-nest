import { Injectable } from '@nestjs/common';
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
    qb.leftJoinAndSelect('order.buyer', 'buyer');
    qb.leftJoinAndSelect('order.vendor', 'vendor');
    qb.leftJoinAndSelect('vendor.store', 'store');

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
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: [
        'buyer',
        'vendor',
        'vendor.store',
        'delivery',
        'delivery_address',
      ],
    });

    return {
      message: 'Order retrieved successfully',
      data: order,
    };
  }
}
