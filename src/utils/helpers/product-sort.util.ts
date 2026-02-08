import { SelectQueryBuilder } from 'typeorm';

export const applyProductSort = (
  qb: SelectQueryBuilder<any>,
  sort?: string,
) => {
  switch (sort) {
    case 'rating':
      return qb.orderBy('product.rating_average', 'DESC');
    case 'newest':
      return qb.orderBy('product.created_at', 'DESC');
    case 'price_asc':
      return qb.orderBy('product.price', 'ASC');
    case 'price_desc':
      return qb.orderBy('product.price', 'DESC');
    case 'a_z':
      return qb.orderBy('product.name', 'ASC');
    case 'z_a':
      return qb.orderBy('product.name', 'DESC');
    default:
      return qb.orderBy('product.created_at', 'DESC');
  }
};
