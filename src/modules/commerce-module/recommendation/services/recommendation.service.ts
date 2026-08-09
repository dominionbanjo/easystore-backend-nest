import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { Cart } from 'src/modules/commerce-module/cart/entities/cart.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { ProductCustomer } from 'src/modules/commerce-module/product/entities/product-customer.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { WishlistService } from 'src/modules/commerce-module/wishlist/wishlist.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import {
  addProductCardSelects,
  mapToProductCardData,
} from 'src/modules/commerce-module/product/utils/product-card.util';
import { UserPreference } from '../entities/user-preference.entity';
import { SavePreferencesDto } from '../dto/save-preferences.dto';

/* ────────────────────────────────────────────────
   RECOMMENDATION SIGNALS & WEIGHTS
   strong   = explicit preferences + purchase history
   weak     = wishlist + cart intent
   collab   = "users who bought the same items also bought"
   local    = store address_state matches the shopper's state
──────────────────────────────────────────────── */
const STRONG_AFFINITY_BOOST = 2.0;
const WEAK_AFFINITY_BOOST = 1.0;
const COLLAB_BOOST = 1.5;
const LOCAL_BOOST = 1.5;
const PURCHASE_WINDOW_DAYS = 30;
const CANDIDATE_MULTIPLIER = 3; // fetch extra candidates, re-rank with collab in JS

interface RawScoreRow {
  product_id: string;
  base_score: string;
}

interface SignalProfile {
  strongIds: string[];
  weakIds: string[];
  purchasedIds: Set<string>;
  collab: Map<string, number>;
}

@Injectable()
export class RecommendationService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,

    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,

    @InjectRepository(UserPreference)
    private readonly preferenceRepo: Repository<UserPreference>,

    @InjectRepository(ProductCustomer)
    private readonly productCustomerRepo: Repository<ProductCustomer>,

    private readonly wishlistService: WishlistService,
    private readonly cache: CacheService,
  ) {}

  /* ────────────────────────────────────────────────
     🌟 FOR YOU — personalized rail (guest → trending)
  ──────────────────────────────────────────────── */
  async getForYou(query: PaginationQueryDto, userId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 48);

    if (!userId) {
      return this.getTrending(query);
    }

    const signals = await this.collectSignals(userId);

    const hasAffinity =
      signals.strongIds.length > 0 || signals.weakIds.length > 0;
    if (!hasAffinity && signals.collab.size === 0) {
      return this.getTrending(query, userId);
    }

    const wishlistSet =
      await this.wishlistService.getWishlistProductIds(userId);

    const qb = this.buildBaseQuery(query);
    qb.setParameters({
      strongIds: signals.strongIds,
      weakIds: signals.weakIds,
      ...(query.state ? { recState: query.state } : {}),
    }).addSelect(
      `
        (
          (CASE WHEN product.category_id = ANY(:strongIds) THEN ${STRONG_AFFINITY_BOOST} ELSE 0 END)
          + (CASE WHEN product.category_id = ANY(:weakIds) THEN ${WEAK_AFFINITY_BOOST} ELSE 0 END)
          + LN(1 + COALESCE(product.total_sold, 0)) * 0.8
          + COALESCE(product.rating_average, 0) * 0.3
          + (CASE WHEN product.on_sale THEN 0.5 ELSE 0 END)
          ${this.localBoostSql(query.state)}
        )
      `,
      'base_score',
    );

    if (signals.purchasedIds.size > 0) {
      qb.andWhere('product.id NOT IN (:...purchasedIds)').setParameters({
        purchasedIds: Array.from(signals.purchasedIds),
      });
    }

    const total = await qb.clone().getCount();

    const { raw, entities } = await qb
      .orderBy('base_score', 'DESC')
      .addOrderBy('product.total_sold', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit * CANDIDATE_MULTIPLIER)
      .getRawAndEntities<RawScoreRow>();

    const scoreByProduct = new Map(
      raw.map((row) => [row.product_id, Number(row.base_score)]),
    );

    const ranked = entities
      .map((product) => {
        const collabCount = signals.collab.get(product.id);
        const collabScore = collabCount
          ? Math.log(1 + collabCount) * COLLAB_BOOST
          : 0;
        return {
          product,
          score: (scoreByProduct.get(product.id) ?? 0) + collabScore,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const items = ranked.map(({ product }) =>
      mapToProductCardData(product, { wishlistSet }),
    );

    return {
      message: 'Personalized recommendations retrieved successfully',
      data: {
        ...buildPagination(items, total, page, limit),
        personalized: true,
      },
    };
  }

  /* ────────────────────────────────────────────────
     🔥 TRENDING — popularity rail + guest fallback
  ──────────────────────────────────────────────── */
  async getTrending(query: PaginationQueryDto, userId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 48);

    const cacheKey = `svc:rec:trending:v1:${page}-${limit}-${query.state ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && !userId) return cached;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const qb = this.buildBaseQuery(query).addSelect(
      `
        (
          LN(1 + COALESCE(product.total_sold, 0)) * 3.0
          + COALESCE(product.rating_average, 0) * 2.0
          + (CASE WHEN product.on_sale THEN 0.5 ELSE 0 END)
          + (CASE WHEN product.created_at >= NOW() - INTERVAL '${PURCHASE_WINDOW_DAYS} days' THEN 0.5 ELSE 0 END)
          ${this.localBoostSql(query.state)}
        )
      `,
      'base_score',
    );

    const total = await qb.clone().getCount();

    const { raw, entities } = await qb
      .orderBy('base_score', 'DESC')
      .addOrderBy('product.total_sold', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities<RawScoreRow>();

    void raw;

    const items = entities.map((product) =>
      mapToProductCardData(product, { wishlistSet }),
    );

    const response = {
      message: 'Trending products retrieved successfully',
      data: {
        ...buildPagination(items, total, page, limit),
        personalized: false,
      },
    };

    if (!userId) {
      await this.cache.set(cacheKey, response);
    }

    return response;
  }

  /* ────────────────────────────────────────────────
     🏷️ DEALS — deepest discounts first
  ──────────────────────────────────────────────── */
  async getDeals(query: PaginationQueryDto, userId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 48);

    const cacheKey = `svc:rec:deals:v1:${page}-${limit}-${query.state ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached && !userId) return cached;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const qb = this.buildBaseQuery(query)
      .andWhere('product.on_sale = :onSale', { onSale: true })
      .andWhere('product.discount_price IS NOT NULL')
      .andWhere('product.price IS NOT NULL')
      .andWhere('product.discount_price < product.price')
      .andWhere('product.stock > 0')
      .addSelect(
        `
        (
          (1 - product.discount_price::numeric / NULLIF(product.price, 0)) * 2.0
          + LN(1 + COALESCE(product.total_sold, 0)) * 0.5
          + (CASE WHEN product.rating_average >= 4 THEN 0.5 ELSE 0 END)
          ${this.localBoostSql(query.state)}
        )
      `,
        'base_score',
      );

    const total = await qb.clone().getCount();

    const { raw, entities } = await qb
      .orderBy('base_score', 'DESC')
      .addOrderBy('product.total_sold', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities<RawScoreRow>();

    void raw;

    const items = entities.map((product) =>
      mapToProductCardData(product, { wishlistSet }),
    );

    const response = {
      message: 'Deal products retrieved successfully',
      data: {
        ...buildPagination(items, total, page, limit),
        personalized: false,
      },
    };

    if (!userId) {
      await this.cache.set(cacheKey, response);
    }

    return response;
  }

  /* ────────────────────────────────────────────────
     🎯 PREFERENCES (explicit interests)
  ──────────────────────────────────────────────── */
  async getUserPreferences(userId: string) {
    const pref = await this.preferenceRepo.findOne({
      where: { user_id: userId },
      select: ['category_ids'],
    });

    return {
      message: 'User preferences retrieved successfully',
      data: {
        category_ids: pref?.category_ids ?? [],
      },
    };
  }

  async savePreferences(userId: string, dto: SavePreferencesDto) {
    const existing = await this.preferenceRepo.findOne({
      where: { user_id: userId },
      select: ['id'],
    });

    if (existing) {
      await this.preferenceRepo.update(existing.id, {
        category_ids: dto.category_ids,
      });
    } else {
      await this.preferenceRepo.save(
        this.preferenceRepo.create({
          user_id: userId,
          category_ids: dto.category_ids,
        }),
      );
    }

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     🧠 SIGNAL COLLECTION
  ──────────────────────────────────────────────── */
  private async collectSignals(userId: string): Promise<SignalProfile> {
    const strongIds = new Set<string>();
    const weakIds = new Set<string>();
    const purchasedIds = new Set<string>();
    const purchasedFromOrders = new Set<string>();
    const wishlistedIds = new Set<string>();
    const cartProductIds = new Set<string>();

    // 1️⃣ Explicit preferences — strongest signal
    const pref = await this.preferenceRepo.findOne({
      where: { user_id: userId },
      select: ['category_ids'],
    });
    if (pref) {
      pref.category_ids.forEach((id) => strongIds.add(id));
    }

    // 2️⃣ Purchase history — orders snapshot items
    const orders = await this.orderRepo.find({
      where: { buyer_id: userId },
      select: ['order_items', 'status'],
      order: { created_at: 'DESC' },
      take: 100,
    });
    for (const order of orders) {
      if (order.status === 'failed' || order.status === 'canceled') continue;
      for (const item of order.order_items ?? []) {
        purchasedFromOrders.add(item.product_id);
      }
    }

    // 3️⃣ Verified purchases — product_customers (review-gated table)
    const verified = await this.productCustomerRepo.find({
      where: { user_id: userId },
      select: ['product_id'],
      take: 100,
    });
    verified.forEach((row) => purchasedIds.add(row.product_id));
    purchasedFromOrders.forEach((id) => purchasedIds.add(id));

    // 4️⃣ Wishlist — strong intent
    const wishlistRows = await this.wishlistRepo.find({
      where: { user_id: userId },
      select: ['product_id'],
      take: 200,
    });
    wishlistRows.forEach((row) => wishlistedIds.add(row.product_id));

    // 5️⃣ Cart — immediate intent
    const cart = await this.cartRepo.findOne({
      where: { user_id: userId },
      select: ['cart_items'],
    });
    for (const item of cart?.cart_items ?? []) {
      cartProductIds.add(item.product_id);
    }

    // 6️⃣ Resolve category affinities from the signal product ids
    const allSignalIds = new Set([
      ...purchasedFromOrders,
      ...wishlistedIds,
      ...cartProductIds,
    ]);
    if (allSignalIds.size > 0) {
      const signalProducts = await this.productRepo.find({
        where: { id: In(Array.from(allSignalIds)) },
        select: ['id', 'category_id'],
      });
      const categoryByProduct = new Map(
        signalProducts.map((product) => [product.id, product.category_id]),
      );

      for (const id of purchasedFromOrders) {
        const categoryId = categoryByProduct.get(id);
        if (categoryId) strongIds.add(categoryId);
      }
      for (const id of wishlistedIds) {
        const categoryId = categoryByProduct.get(id);
        if (categoryId) weakIds.add(categoryId);
      }
      for (const id of cartProductIds) {
        const categoryId = categoryByProduct.get(id);
        if (categoryId) weakIds.add(categoryId);
      }
    }

    // 7️⃣ Collaborative — "others who bought what I bought, also bought"
    const collab = new Map<string, number>();
    const myProducts = Array.from(purchasedIds).slice(0, 50);
    if (myProducts.length > 0) {
      const collabRows = await this.productCustomerRepo
        .createQueryBuilder('pc2')
        .select('pc2.product_id', 'product_id')
        .addSelect('COUNT(DISTINCT pc2.user_id)', 'buyers')
        .where(
          `pc2.user_id IN (
            SELECT DISTINCT pc.user_id
            FROM product_customers pc
            WHERE pc.product_id IN (:...myProductIds)
          )`,
        )
        .andWhere('pc2.user_id != :me')
        .andWhere('pc2.product_id NOT IN (:...myProductIds)')
        .groupBy('pc2.product_id')
        .setParameters({ myProductIds: myProducts, me: userId })
        .getRawMany<{ product_id: string; buyers: string }>();

      collabRows
        .sort((a, b) => Number(b.buyers) - Number(a.buyers))
        .slice(0, 60)
        .forEach((row) => collab.set(row.product_id, Number(row.buyers)));
    }

    return {
      strongIds: Array.from(strongIds),
      weakIds: Array.from(weakIds),
      purchasedIds,
      collab,
    };
  }

  /* ────────────────────────────────────────────────
     🔨 SHARED QUERY SCAFFOLD
  ──────────────────────────────────────────────── */
  private buildBaseQuery(query: PaginationQueryDto) {
    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        'users',
        'user',
        'user.id = product.vendor_id AND user.account_status = :userStatus',
        { userStatus: 'active' },
      )
      .innerJoin(
        'stores',
        'vendorStore',
        'vendorStore.id = product.store_id AND vendorStore.status = :storeStatus',
        { storeStatus: 'active' },
      )
      .where('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .addSelect('product.total_sold');

    if (query.state) {
      qb.setParameters({ recState: query.state });
    }

    return qb;
  }

  private localBoostSql(state?: string) {
    return state
      ? `+ (CASE WHEN store.address_state = :recState THEN ${LOCAL_BOOST} ELSE 0 END)`
      : '';
  }
}
