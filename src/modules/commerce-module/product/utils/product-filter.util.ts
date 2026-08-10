import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Filter parameters shared by every product browse endpoint
 * (marketplace search, school zone products, etc.).
 */
export interface ProductFilterParams {
  minPrice?: number;
  maxPrice?: number;
  country?: string;
  state?: string;
  city?: string;
  rating?: number;
  inStock?: boolean;
  local?: boolean;
  filter?: Record<string, string[]>;
}

/**
 * Applies price / location / rating / stock / dynamic variant filters to a
 * product query builder. Prices are accepted in naira and converted to kobo.
 * The `store.` alias must resolve on the query (via product card selects).
 */
export const applyProductFilters = (
  qb: SelectQueryBuilder<ObjectLiteral>,
  params: ProductFilterParams,
): SelectQueryBuilder<ObjectLiteral> => {
  const {
    minPrice,
    maxPrice,
    country,
    state,
    city,
    rating,
    inStock,
    local = false,
    filter = {},
  } = params;

  if (minPrice !== undefined) {
    qb.andWhere('product.price >= :minPrice', { minPrice: minPrice * 100 });
  }
  if (maxPrice !== undefined) {
    qb.andWhere('product.price <= :maxPrice', { maxPrice: maxPrice * 100 });
  }
  if (country) {
    qb.andWhere('store.address_country ILIKE :country', {
      country: `%${country}%`,
    });
  }
  if (state && !local) {
    qb.andWhere('store.address_state ILIKE :state', {
      state: `%${state}%`,
    });
  }
  if (city) {
    qb.andWhere('store.address_city ILIKE :city', {
      city: `%${city}%`,
    });
  }
  if (inStock) {
    qb.andWhere('product.stock > 0');
  }
  if (rating) {
    qb.andWhere('product.rating_average >= :rating', { rating });
  }

  // Dynamically apply variant combination filters (e.g. Color:Red|Size:M,L)
  Object.entries(filter).forEach(([key, values], idx) => {
    if (!values || values.length === 0) return;
    values.forEach((val, vIdx) => {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = product.id
          AND pv.combinations->>:key${idx} ILIKE :val${idx}_${vIdx}
        )`,
        { [`key${idx}`]: key, [`val${idx}_${vIdx}`]: val },
      );
    });
  });

  return qb;
};

const SORT_COLUMNS: Record<string, readonly [string, 'ASC' | 'DESC']> = {
  price_asc: ['product.price', 'ASC'],
  price_desc: ['product.price', 'DESC'],
  rating_desc: ['product.rating_average', 'DESC'],
  date_desc: ['product.created_at', 'DESC'],
};

/**
 * Applies the frontend sort contract. `relevance` (or no sort) keeps the
 * rank-first ordering when the query was ranked, otherwise newest first.
 */
export const applyProductSortOrder = (
  qb: SelectQueryBuilder<ObjectLiteral>,
  sort?: string,
  options?: { ranked?: boolean },
): SelectQueryBuilder<ObjectLiteral> => {
  if (!sort || sort === 'relevance') {
    if (options?.ranked) {
      return qb.orderBy('rank', 'DESC').addOrderBy('product.created_at', 'DESC');
    }
    return qb.orderBy('product.created_at', 'DESC');
  }

  const [column, direction] = SORT_COLUMNS[sort] ?? SORT_COLUMNS.date_desc;
  return qb.orderBy(column, direction);
};

