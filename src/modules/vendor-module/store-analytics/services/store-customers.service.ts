import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreCustomer } from '../entities/store_customers.entity';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class StoreCustomersService {
  constructor(
    @InjectRepository(StoreCustomer)
    private readonly customerRepo: Repository<StoreCustomer>,
  ) {}

  async getStoreCustomers(
    store_id: string,
    query: {
      search?: string;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const {
      search,
      page = 1,
      limit = 10,
      sort = 'created_at',
      order = 'DESC',
    } = query;

    const qb = this.customerRepo
      .createQueryBuilder('customer')
      .where('customer.store_id = :store_id', { store_id });

    if (search) {
      qb.andWhere(
        '(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.location ILIKE :search OR customer.phone_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`customer.${sort}`, order);

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const pagination = buildPagination(items, total, page, limit);

    return {
      message: 'Store customers retrieved successfully',
      data: pagination,
    };
  }
}
