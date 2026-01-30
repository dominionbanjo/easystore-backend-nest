import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { sanitizeReviewUser } from './sanitizeUser';

export function buildProductResponse(product: Product) {
  const { store, reviews, category_ref, ...rest } = product;

  return {
    product: {
      ...rest,
      category: category_ref
        ? {
            id: category_ref.id,
            name: category_ref.name,
            slug: category_ref.slug,
          }
        : null,
    },

    store: store
      ? {
          id: store.id,
          store_name: store.store_name,
          slug: store.slug,
          logo: store.logo,
          cover_image: store.cover_image,
          rating_average: store.rating_average,
          rating_count: store.rating_count,

          /* 🔁 RECONSTRUCT LOCATION FROM COLUMNS */
          location: {
            street: store.address_street ?? null,
            city: store.address_city ?? null,
            state: store.address_state ?? null,
            country: store.address_country ?? null,
            postal_code: store.address_postal_code ?? null,
          },
        }
      : null,

    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      user: sanitizeReviewUser(review.user),
    })),
  };
}
