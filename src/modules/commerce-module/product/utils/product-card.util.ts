import { SelectQueryBuilder } from 'typeorm';
import { Product } from '../entities/product.entity';

export function addProductCardSelects(
  qb: SelectQueryBuilder<Product>,
  options?: {
    withStore?: boolean;
    alias?: string;
  },
): SelectQueryBuilder<Product> {
  const alias = options?.alias || 'product';

  const selects = [
    `${alias}.id`,
    `${alias}.name`,
    `${alias}.slug`,
    `${alias}.price`,
    `${alias}.image`,
    `${alias}.rating_average`,
    `${alias}.stock`,
    `${alias}.created_at`,
    `${alias}.options`,
    `${alias}.discount_price`,
    `${alias}.on_sale`,
    `${alias}.featured`,
    'category.id',
    'category.name',
    'category.slug',
  ];

  qb.select(selects)
    .leftJoin(`${alias}.category_ref`, 'category')
    .leftJoinAndSelect(`${alias}.variants`, 'variants');

  if (options?.withStore) {
    qb.leftJoin(`${alias}.store`, 'store');
    qb.addSelect([
      'store.id',
      'store.store_name',
      'store.slug',
      'store.address_city',
      'store.address_state',
      'store.address_country',
      'store.address_postal_code',
    ]);
  }

  return qb;
}

export function mapToProductCardData(
  p: Product,
  options?: {
    wishlistSet?: Set<string>;
    extra?: any;
  },
) {
  const isInWishlist = options?.wishlistSet?.has(p.id) ?? false;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price) / 100,
    image: p.image?.url ?? null,
    rating_average: Number(p.rating_average),
    stock: p.stock,
    discount_price: p.discount_price ? Number(p.discount_price) / 100 : null,
    on_sale: p.on_sale,
    featured: p.featured,
    category: p.category_ref?.name,
    options: p.options || [],
    variants: (p.variants || []).map((v) => ({
      ...v,
      price: v.price ? Number(v.price) / 100 : 0,
      discount_price: v.discount_price ? Number(v.discount_price) / 100 : null,
    })),
    store_name: p.store?.store_name,
    store_slug: p.store?.slug,
    address_city: p.store?.address_city,
    address_state: p.store?.address_state,
    address_country: p.store?.address_country,
    address_postal_code: p.store?.address_postal_code,
    created_at: p.created_at,
    is_in_wishlist: isInWishlist,
    ...options?.extra,
  };
}
