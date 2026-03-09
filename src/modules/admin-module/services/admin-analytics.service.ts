import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { Transaction } from 'src/modules/finance-module/transactions/entities/transaction.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /* ─────────────────────────────────────────────────
     OVERVIEW — top-level KPIs for dashboard
  ────────────────────────────────────────────────── */
  async getOverviewStats() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    // Total counts
    const [totalUsers, totalVendors, totalStores, totalProducts, totalOrders] =
      await Promise.all([
        this.userRepo.count({ where: { account_type: 'user' } }),
        this.userRepo.count({ where: { account_type: 'vendor' } }),
        this.storeRepo.count(),
        this.productRepo.count(),
        this.orderRepo.count(),
      ]);

    // User status breakdown
    const userStatusBreakdown = await this.userRepo
      .createQueryBuilder('u')
      .select('u.account_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.account_status')
      .getRawMany();

    // Vendor status breakdown (using store.status)
    const vendorStatusBreakdown = await this.storeRepo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.status')
      .getRawMany();

    // Revenue this month vs last month
    const thisMonthRevenue = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.status = :status', { status: 'success' })
      .andWhere('tx.created_at >= :start', { start: thisMonthStart })
      .getRawOne();

    const lastMonthRevenue = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.status = :status', { status: 'success' })
      .andWhere('tx.created_at >= :start AND tx.created_at <= :end', {
        start: lastMonthStart,
        end: lastMonthEnd,
      })
      .getRawOne();

    // New users this month
    const newUsersThisMonth = await this.userRepo
      .createQueryBuilder('u')
      .where('u.created_at >= :start', { start: thisMonthStart })
      .getCount();

    const newUsersLastMonth = await this.userRepo
      .createQueryBuilder('u')
      .where('u.created_at >= :start AND u.created_at <= :end', {
        start: lastMonthStart,
        end: lastMonthEnd,
      })
      .getCount();

    // Pending vendor approvals (based on store.status)
    const pendingVendors = await this.storeRepo.count({
      where: { status: 'pending' },
    });

    // Transaction status breakdown
    const txStatusBreakdown = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('tx.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'total')
      .groupBy('tx.status')
      .getRawMany();

    // Orders this month
    const ordersThisMonth = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :start', { start: thisMonthStart })
      .getCount();

    const ordersLastMonth = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :start AND o.created_at <= :end', {
        start: lastMonthStart,
        end: lastMonthEnd,
      })
      .getCount();

    return {
      message: 'Overview statistics',
      data: {
        totals: {
          users: totalUsers,
          vendors: totalVendors,
          stores: totalStores,
          products: totalProducts,
          orders: totalOrders,
        },
        revenue: {
          thisMonth: Number(thisMonthRevenue?.total || 0),
          lastMonth: Number(lastMonthRevenue?.total || 0),
        },
        newUsers: {
          thisMonth: newUsersThisMonth,
          lastMonth: newUsersLastMonth,
        },
        orders: {
          thisMonth: ordersThisMonth,
          lastMonth: ordersLastMonth,
        },
        pendingVendors,
        userStatusBreakdown,
        vendorStatusBreakdown,
        transactionStatusBreakdown: txStatusBreakdown,
      },
    };
  }

  /* ─────────────────────────────────────────────────
     GROWTH CHART — monthly user / vendor / revenue
  ────────────────────────────────────────────────── */
  async getGrowthChart(months = 12) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const now = new Date();

    // Build month buckets
    const buckets: {
      label: string;
      year: number;
      month: number;
      startDate: Date;
      endDate: Date;
    }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      buckets.push({
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        startDate: d,
        endDate: endD,
      });
    }

    // Users per month
    const usersPerMonth = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.created_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'count')
      .where('u.created_at >= :start', {
        start: buckets[0].startDate,
      })
      .groupBy("TO_CHAR(u.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC')
      .getRawMany();

    // Vendors per month
    const vendorsPerMonth = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.created_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'count')
      .where('u.account_type = :type AND u.created_at >= :start', {
        type: 'vendor',
        start: buckets[0].startDate,
      })
      .groupBy("TO_CHAR(u.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC')
      .getRawMany();

    // Revenue per month (successful transactions)
    const revenuePerMonth = await this.transactionRepo
      .createQueryBuilder('tx')
      .select("TO_CHAR(tx.created_at, 'YYYY-MM')", 'period')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.status = :status AND tx.created_at >= :start', {
        status: 'success',
        start: buckets[0].startDate,
      })
      .groupBy("TO_CHAR(tx.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC')
      .getRawMany();

    // Orders per month
    const ordersPerMonth = await this.orderRepo
      .createQueryBuilder('o')
      .select("TO_CHAR(o.created_at, 'YYYY-MM')", 'period')
      .addSelect('COUNT(*)', 'count')
      .where('o.created_at >= :start', {
        start: buckets[0].startDate,
      })
      .groupBy("TO_CHAR(o.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC')
      .getRawMany();

    // Map into a single chart array
    const toMap = (rows: any[]) => {
      const m = new Map<string, number>();
      rows.forEach((r) => m.set(r.period, Number(r.count || r.total || 0)));
      return m;
    };

    const usersMap = toMap(usersPerMonth);
    const vendorsMap = toMap(vendorsPerMonth);
    const revenueMap = toMap(revenuePerMonth);
    const ordersMap = toMap(ordersPerMonth);

    const chart = buckets.map((b) => {
      const period = `${b.year}-${String(b.month + 1).padStart(2, '0')}`;
      return {
        label: b.label,
        period,
        users: usersMap.get(period) || 0,
        vendors: vendorsMap.get(period) || 0,
        revenue: revenueMap.get(period) || 0,
        orders: ordersMap.get(period) || 0,
      };
    });

    return { message: 'Growth chart data', data: chart };
  }

  /* ─────────────────────────────────────────────────
     USER DISTRIBUTION — account types pie chart
  ────────────────────────────────────────────────── */
  async getUserDistribution() {
    const distribution = await this.userRepo
      .createQueryBuilder('u')
      .select('u.account_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.account_type')
      .getRawMany();

    return {
      message: 'User distribution',
      data: distribution.map((d) => ({
        name: d.type.charAt(0).toUpperCase() + d.type.slice(1) + 's',
        value: Number(d.count),
      })),
    };
  }

  /* ─────────────────────────────────────────────────
     TRANSACTION TYPE BREAKDOWN — bar chart
  ────────────────────────────────────────────────── */
  async getTransactionTypeBreakdown() {
    const breakdown = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('tx.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'total')
      .groupBy('tx.type')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      message: 'Transaction type breakdown',
      data: breakdown.map((r) => ({
        name: r.type.replace(/_/g, ' '),
        count: Number(r.count),
        total: Number(r.total),
      })),
    };
  }

  /* ─────────────────────────────────────────────────
     RECENT SIGNUPS — latest 10 users
  ────────────────────────────────────────────────── */
  async getRecentSignups(limit = 10) {
    const users = await this.userRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'account_type',
        'account_status',
        'created_at',
      ],
    });

    return { message: 'Recent signups', data: users };
  }

  /* ─────────────────────────────────────────────────
     TOP STORES — by revenue
  ────────────────────────────────────────────────── */
  async getTopStores(limit = 10) {
    const stores = await this.storeRepo.find({
      order: { total_revenue: 'DESC' },
      take: limit,
      select: [
        'id',
        'store_name',
        'slug',
        'category',
        'total_revenue',
        'total_orders',
        'total_products',
        'rating_average',
        'created_at',
      ],
    });

    return { message: 'Top stores by revenue', data: stores };
  }

  /* ─────────────────────────────────────────────────
     ORDER STATUS BREAKDOWN — for reports
  ────────────────────────────────────────────────── */
  async getOrderStatusBreakdown() {
    const breakdown = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.total), 0)', 'totalAmount')
      .groupBy('o.status')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      message: 'Order status breakdown',
      data: breakdown.map((r) => ({
        name: r.status.replace(/_/g, ' '),
        count: Number(r.count),
        totalAmount: Number(r.totalAmount),
      })),
    };
  }

  /* ─────────────────────────────────────────────────
     REVENUE BY MONTH — detailed line chart for reports
  ────────────────────────────────────────────────── */
  async getRevenueByMonth(months = 12) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const raw = await this.transactionRepo
      .createQueryBuilder('tx')
      .select("TO_CHAR(tx.created_at, 'YYYY-MM')", 'period')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'revenue')
      .addSelect('COUNT(*)', 'txCount')
      .where('tx.status = :status AND tx.created_at >= :start', {
        status: 'success',
        start,
      })
      .groupBy("TO_CHAR(tx.created_at, 'YYYY-MM')")
      .orderBy('period', 'ASC')
      .getRawMany();

    const revenueMap = new Map<string, { revenue: number; txCount: number }>();
    raw.forEach((r) =>
      revenueMap.set(r.period, {
        revenue: Number(r.revenue),
        txCount: Number(r.txCount),
      }),
    );

    // Build complete chart
    const chart: { month: string; revenue: number; txCount: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = revenueMap.get(period);
      chart.push({
        month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        revenue: data?.revenue ?? 0,
        txCount: data?.txCount ?? 0,
      });
    }

    return { message: 'Revenue by month', data: chart };
  }

  /* ─────────────────────────────────────────────────
     SIGNUP METHODS — signup medium distribution
  ────────────────────────────────────────────────── */
  async getSignupMethods() {
    const data = await this.userRepo
      .createQueryBuilder('u')
      .select('u.signup_medium', 'method')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.signup_medium')
      .getRawMany();

    return {
      message: 'Signup methods',
      data: data.map((d) => ({
        name: d.method === 'google' ? 'Google' : 'Email/Password',
        value: Number(d.count),
      })),
    };
  }
}
