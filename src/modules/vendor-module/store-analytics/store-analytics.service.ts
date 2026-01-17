import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StoreAnalytics,
  StoreAnalyticsData,
  StoreCustomerSnapshot,
} from './entities/store-analytics.entity';
import { ICartItem } from 'src/modules/commerce-module/cart/types/types';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';

@Injectable()
export class StoreAnalyticsService {
  constructor(
    private readonly cache: CacheService,

    @InjectRepository(StoreAnalytics)
    private readonly analyticsRepo: Repository<StoreAnalytics>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* ────────────────────────────────────────────────
     INTERNAL: NORMALIZE ANALYTICS JSON
  ──────────────────────────────────────────────── */
  private normalizeAnalytics(
    analytics?: Partial<StoreAnalyticsData>,
  ): StoreAnalyticsData {
    return {
      sales: analytics?.sales ?? [],
      orders: analytics?.orders ?? [],
      customers: analytics?.customers ?? [],
      top_products: analytics?.top_products ?? [],
    };
  }

  /* ────────────────────────────────────────────────
     CREATE EMPTY ANALYTICS (ON STORE CREATE)
  ──────────────────────────────────────────────── */
  async createForStore(storeId: string) {
    const analytics = this.analyticsRepo.create({
      store_id: storeId,
      total_revenue: 0,
      total_orders: 0,
      total_customers: 0,
      conversion_rate: 0,
      analytics: this.normalizeAnalytics(),
      customers: [],
      last_order_at: null,
    });

    return this.analyticsRepo.save(analytics);
  }

  /* ────────────────────────────────────────────────
     UPDATE ANALYTICS FROM ORDER
  ──────────────────────────────────────────────── */
  async updateFromOrder(
    storeId: string,
    amount: number,
    customerId: string,
    items: ICartItem[],
  ) {
    const row = await this.analyticsRepo.findOne({
      where: { store_id: storeId },
    });

    if (!row) throw new NotFoundException('Store analytics not found');

    const now = new Date();
    const month = now.toLocaleString('en', { month: 'short' });
    const year = now.getFullYear();
    const today = now.toISOString();

    const analytics = this.normalizeAnalytics(row.analytics);
    const customers: StoreCustomerSnapshot[] = row.customers ?? [];

    /* ───────── SALES ───────── */
    let sale = analytics.sales.find(
      (s) => s.month === month && s.year === year,
    );
    if (!sale) {
      sale = { month, year, amount: 0 };
      analytics.sales.push(sale);
    }
    sale.amount += amount;

    /* ───────── ORDERS ───────── */
    let order = analytics.orders.find(
      (o) => o.month === month && o.year === year,
    );
    if (!order) {
      order = { month, year, count: 0 };
      analytics.orders.push(order);
    }
    order.count += 1;

    /* ───────── MONTHLY UNIQUE CUSTOMERS ───────── */
    let custMonth = analytics.customers.find(
      (c) => c.month === month && c.year === year,
    );
    if (!custMonth) {
      custMonth = { month, year, count: 0, customer_ids: [] };
      analytics.customers.push(custMonth);
    }
    if (!custMonth.customer_ids.includes(customerId)) {
      custMonth.customer_ids.push(customerId);
      custMonth.count += 1;
    }

    /* ───────── CUSTOMER SNAPSHOT ───────── */
    let customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      const user = await this.userRepo.findOne({
        where: { id: customerId },
      });

      customer = {
        id: customerId,
        name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
        email: user?.email ?? '',
        phone_number: user?.phone_number ?? null,
        location:
          user?.address?.city ||
          user?.address?.state ||
          user?.address?.country ||
          null,
        orders: 0,
        spent: 0,
        rating: 0,
        last_order_date: null,
      };

      customers.push(customer);
    }

    customer.orders += 1;
    customer.spent += amount;
    customer.last_order_date = today;

    /* ───────── TOP PRODUCTS (MAX 110) ───────── */
    for (const item of items) {
      let prod = analytics.top_products.find(
        (p) => p.product_id === item.product_id,
      );

      const revenue = item.price * item.quantity;

      if (!prod) {
        prod = {
          product_id: item.product_id,
          name: item.name,
          slug: item.slug,
          image: item.image,
          total_sold: 0,
          total_revenue: 0,
        };
        analytics.top_products.push(prod);
      }

      prod.total_sold += item.quantity;
      prod.total_revenue += revenue;
    }

    analytics.top_products = analytics.top_products
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 110);

    /* ───────── TOTALS ───────── */
    row.total_revenue += amount;
    row.total_orders += 1;
    row.total_customers = customers.length;
    row.conversion_rate =
      row.total_customers > 0
        ? Number(((row.total_orders / row.total_customers) * 100).toFixed(2))
        : 0;

    row.last_order_at = now;
    row.analytics = analytics;
    row.customers = customers;

    await this.analyticsRepo.save(row);
    await this.cache.clearPrefix('svc:store:analytics');

    return analytics;
  }

  /* ────────────────────────────────────────────────
     GET ANALYTICS SNAPSHOT
  ──────────────────────────────────────────────── */
  async getAnalytics(storeId: string) {
    const key = `svc:store:analytics:${storeId}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const row = await this.analyticsRepo.findOne({
      where: { store_id: storeId },
    });

    if (!row) throw new NotFoundException('Store analytics not found');

    const analytics = this.normalizeAnalytics(row.analytics);

    const result = {
      summary: {
        total_sales: row.total_revenue,
        orders: row.total_orders,
        customers: row.total_customers,
        conversion_rate: row.conversion_rate,
      },
      analytics,
      customers: row.customers ?? [],
      top_products: analytics.top_products,
    };

    await this.cache.set(key, result);
    return result;
  }
}
