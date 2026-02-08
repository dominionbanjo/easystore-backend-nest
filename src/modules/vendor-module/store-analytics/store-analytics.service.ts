import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StoreAnalytics } from './entities/store-analytics.entity';
import { ICartItem } from 'src/modules/commerce-module/cart/types/types';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { Store } from '../store/entities/store.entity';
import { StoreMonthlyAnalytics } from './entities/store_monthly_analytics.entity';
import { StoreCustomer } from './entities/store_customers.entity';
import { StoreService } from '../store/services/store.service';

@Injectable()
export class StoreAnalyticsService {
  constructor(
    private readonly cache: CacheService,

    @InjectRepository(StoreAnalytics)
    private readonly analyticsRepo: Repository<StoreAnalytics>,

    @Inject(forwardRef(() => StoreService))
    private readonly storeService: StoreService,

    // @InjectRepository(User)
    // private readonly userRepo: Repository<User>,
  ) {}

  /* ────────────────────────────────────────────────
     INTERNAL: NORMALIZE ANALYTICS JSON
  ──────────────────────────────────────────────── */

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
      last_order_at: null,
    });

    return this.analyticsRepo.save(analytics);
  }

  /* ────────────────────────────────────────────────
     UPDATE ANALYTICS FROM ORDER
  ──────────────────────────────────────────────── */
  async updateFromOrder(
    storeId: string,
    amount: number, // kept for backward compatibility, but NOT trusted
    customerId: string,
    items: ICartItem[],
  ) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1–12

    // ✅ SOURCE OF TRUTH: compute order total
    const orderTotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );

    await this.analyticsRepo.manager.transaction(async (manager) => {
      /* ────────────────────────────────────────────────
       1️⃣ LOCK LIFETIME ANALYTICS
    ──────────────────────────────────────────────── */
      const analyticsRow = await manager.findOne(StoreAnalytics, {
        where: { store_id: storeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!analyticsRow) {
        throw new NotFoundException('Store analytics not found');
      }

      /* ────────────────────────────────────────────────
       2️⃣ ENSURE MONTHLY ROW EXISTS
    ──────────────────────────────────────────────── */
      await manager.getRepository(StoreMonthlyAnalytics).upsert(
        {
          store_id: storeId,
          year,
          month,
          revenue: 0,
          orders: 0,
          unique_customers: 0,
        },
        ['store_id', 'year', 'month'],
      );

      /* ────────────────────────────────────────────────
       3️⃣ FETCH CUSTOMER
    ──────────────────────────────────────────────── */
      const user = await manager.findOne(User, {
        where: { id: customerId },
        select: [
          'id',
          'first_name',
          'last_name',
          'email',
          'address',
          'phone_number',
        ],
      });

      if (!user) {
        throw new NotFoundException('Customer not found');
      }

      const location =
        user.address?.city ||
        user.address?.state ||
        user.address?.country ||
        null;

      /* ────────────────────────────────────────────────
       4️⃣ UPSERT STORE CUSTOMER
    ──────────────────────────────────────────────── */
      const storeCustomerRepo = manager.getRepository(StoreCustomer);

      const existingCustomer = await storeCustomerRepo.findOne({
        where: { store_id: storeId, user_id: customerId },
      });

      const isFirstOrderForStore = !existingCustomer;

      if (existingCustomer) {
        await storeCustomerRepo.update(
          { id: existingCustomer.id },
          {
            orders_count: () => `"orders_count" + 1`,
            total_spent: () => `"total_spent" + ${orderTotal}`,
            last_order_at: now,
            phone_number: user.phone_number,
          },
        );
      } else {
        await storeCustomerRepo.insert({
          store_id: storeId,
          user_id: customerId,
          name: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
          location,
          phone_number: user.phone_number,
          orders_count: 1,
          total_spent: orderTotal,
          rating: 0,
          last_order_at: now,
        });
      }

      /* ────────────────────────────────────────────────
       5️⃣ UPDATE MONTHLY ANALYTICS
    ──────────────────────────────────────────────── */
      await manager.query(
        `
      UPDATE store_monthly_analytics
      SET
        revenue = CAST(revenue AS BIGINT) + $1,
        orders = orders + 1,
        unique_customers = unique_customers + $2
      WHERE store_id = $3
        AND year = $4
        AND month = $5
      `,
        [orderTotal, isFirstOrderForStore ? 1 : 0, storeId, year, month],
      );

      /* ────────────────────────────────────────────────
       6️⃣ UPDATE LIFETIME ANALYTICS
    ──────────────────────────────────────────────── */
      // Ensure we treat existing values as numbers (bigint comes as string)
      const currentRevenue = Number(analyticsRow.total_revenue || 0);
      const currentOrders = Number(analyticsRow.total_orders || 0);
      const currentCustomers = Number(analyticsRow.total_customers || 0);

      analyticsRow.total_revenue = currentRevenue + orderTotal;
      analyticsRow.total_orders = currentOrders + 1;

      if (isFirstOrderForStore) {
        analyticsRow.total_customers = currentCustomers + 1;
      }

      const totalCustomers = Number(analyticsRow.total_customers);
      const totalOrders = Number(analyticsRow.total_orders);

      analyticsRow.conversion_rate =
        totalCustomers > 0
          ? Number(((totalOrders / totalCustomers) * 100).toFixed(2))
          : 0;

      analyticsRow.last_order_at = now;

      await manager.save(analyticsRow);
    });

    /* ────────────────────────────────────────────────
     7️⃣ CACHE INVALIDATION
  ──────────────────────────────────────────────── */
    await this.cache.clearPrefix(`svc:store:analytics:${storeId}`);
    await this.cache.clearPrefix(`svc:store:customers:${storeId}`);

    return { success: true };
  }

  async initializeAnalyticsForStore(storeId: string, manager?: EntityManager) {
    const storeRepo = manager
      ? manager.getRepository(Store)
      : this.analyticsRepo.manager.getRepository(Store);
    const analyticsRepo = manager
      ? manager.getRepository(StoreAnalytics)
      : this.analyticsRepo;

    const storeExists = await storeRepo.exist({ where: { id: storeId } });

    if (!storeExists) {
      throw new NotFoundException('Store not found');
    }

    const existing = await analyticsRepo.findOne({
      where: { store_id: storeId },
      select: ['id'],
    });

    if (existing) {
      return { created: false };
    }

    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1–12

    const runWith = manager || this.analyticsRepo.manager;

    await runWith.transaction(async (txnManager) => {
      /* 1️⃣ Create lifetime analytics */
      await txnManager.save(
        txnManager.create(StoreAnalytics, {
          store_id: storeId,
          total_revenue: 0,
          total_orders: 0,
          total_customers: 0,
          conversion_rate: 0,
          last_order_at: null,
        }),
      );

      /* 2️⃣ Create FIRST monthly trend row */
      await txnManager.save(
        txnManager.create(StoreMonthlyAnalytics, {
          store_id: storeId,
          year,
          month,
          revenue: 0,
          orders: 0,
          unique_customers: 0,
        }),
      );
    });

    await this.cache.clearPrefix(`svc:store:analytics:${storeId}`);

    return {
      message: 'Store analytics & trends initialized',
      created: true,
    };
  }

  /* ────────────────────────────────────────────────
     GET ANALYTICS SNAPSHOT
  ──────────────────────────────────────────────── */
  async getAnalytics(storeId: string) {
    const key = `svc:store:analytics:${storeId}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    /* ────────────────────────────────────────────────
     1️⃣ LIFETIME STORE ANALYTICS
  ──────────────────────────────────────────────── */
    const analyticsRow = await this.analyticsRepo.findOne({
      where: { store_id: storeId },
    });

    if (!analyticsRow) {
      throw new NotFoundException('Store analytics not found');
    }

    /* ────────────────────────────────────────────────
     2️⃣ TOTAL PRODUCTS (SOURCE OF TRUTH)
  ──────────────────────────────────────────────── */
    const totalProducts =
      await this.storeService.getTotalProductsForStore(storeId);

    /* ────────────────────────────────────────────────
     3️⃣ MONTHLY TRENDS (FROM TABLE)
  ──────────────────────────────────────────────── */
    const monthlyTrends = await this.analyticsRepo.manager.query(
      `
    SELECT
      year,
      month,
      revenue,
      orders,
      unique_customers
    FROM store_monthly_analytics
    WHERE store_id = $1
    ORDER BY year ASC, month ASC
    `,
      [storeId],
    );

    /* ────────────────────────────────────────────────
     4️⃣ CUSTOMER LIST (TABLE, UI-READY)
  ──────────────────────────────────────────────── */
    const customers = await this.analyticsRepo.manager.query(
      `
    SELECT
      id,
      user_id,
      name,
      email,
      location,
      phone_number,
      orders_count AS orders,
      total_spent AS spent,
      rating,
      last_order_at
    FROM store_customers
    WHERE store_id = $1
    ORDER BY total_spent DESC
    `,
      [storeId],
    );

    /* ────────────────────────────────────────────────
     5️⃣ TOP PRODUCTS (REAL DATA)
  ──────────────────────────────────────────────── */
    const topProducts = await this.analyticsRepo.manager.query(
      `
    SELECT
      p.id            AS product_id,
      p.name,
      p.slug,
      p.image,
      p.total_sold,
      (p.total_sold * p.price) AS total_revenue
    FROM products p
    WHERE p.store_id = $1
    ORDER BY p.total_sold DESC
    LIMIT 10
    `,
      [storeId],
    );

    /* ────────────────────────────────────────────────
     6️⃣ FINAL RESPONSE SHAPE
  ──────────────────────────────────────────────── */
    const result = {
      summary: {
        total_sales: Number(analyticsRow.total_revenue || 0),
        orders: Number(analyticsRow.total_orders || 0),
        customers: Number(analyticsRow.total_customers || 0),
        conversion_rate: Number(analyticsRow.conversion_rate || 0),
        total_products: totalProducts,
      },
      trends: {
        monthly: monthlyTrends,
      },
      customers,
      top_products: topProducts,
    };

    await this.cache.set(key, result);
    return result;
  }
}
