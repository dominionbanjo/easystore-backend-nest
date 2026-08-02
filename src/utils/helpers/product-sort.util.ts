import { SelectQueryBuilder } from 'typeorm';

type SortDirection = 'ASC' | 'DESC';

type ApplyProductSortOptions = {
  /** When set, products from stores in this state rank first (local-first boost) */
  state?: string;
};

const SORT_COLUMNS: Record<string, readonly [string, SortDirection]> = {
  rating: ['product.rating_average', 'DESC'],
  newest: ['product.created_at', 'DESC'],
  price_asc: ['product.price', 'ASC'],
  price_desc: ['product.price', 'DESC'],
  a_z: ['product.name', 'ASC'],
  z_a: ['product.name', 'DESC'],
};

export const applyProductSort = (
  qb: SelectQueryBuilder<any>,
  sort?: string,
  options?: ApplyProductSortOptions,
) => {
  const [column, direction] =
    SORT_COLUMNS[sort ?? 'newest'] ?? SORT_COLUMNS.newest;

  if (options?.state) {
    qb.addSelect('store.address_state = :localState', 'is_local')
      .setParameter('localState', options.state)
      .orderBy('is_local', 'DESC')
      .addOrderBy(column, direction);
    return qb;
  }

  return qb.orderBy(column, direction);
};
