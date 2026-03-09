import { Store } from '../entities/store.entity';

/**
 * Strips sensitive fields for public visibility.
 * No bank info, no internal IDs, no settlement emails.
 */
export function mapToPublicStore(store: Store, totalProductsCount?: number) {
  if (!store) return null;

  const publicUser = store.user
    ? {
        first_name: store.user.first_name,
        last_name: store.user.last_name,
        username: store.user.username,
        avatar: store.user.avatar,
      }
    : null;

  return {
    id: store.id,
    store_name: store.store_name,
    slug: store.slug,
    status: store.status,
    category: store.category,
    description: store.description,
    logo: store.logo,
    cover_image: store.cover_image,
    email: store.email,
    phone_number: store.phone_number,
    social_links: store.social_links,
    rating_average: store.rating_average,
    rating_count: store.rating_count,
    address_city: store.address_city,
    address_state: store.address_state,
    address_country: store.address_country,
    address_postal_code: store.address_postal_code,
    total_products: totalProductsCount ?? store.total_products,
    payout_verified: store.payout_verified,
    created_at: store.created_at,
    user: publicUser,
  };
}

/**
 * Returns store details safe for the OWNER.
 * Includes bank info but strips internal orchestration tokens (like paystack_subaccount_code if not needed).
 */
export function mapToOwnerStore(store: Store) {
  if (!store) return null;

  const {
    paystack_subaccount_code, // strip internal token
    logo_public_id,
    cover_image_public_id,
    ...safeStore
  } = store;

  return {
    ...safeStore,
    // Ensure user is also sanitized if present
    user: store.user
      ? {
          id: store.user.id,
          first_name: store.user.first_name,
          last_name: store.user.last_name,
          username: store.user.username,
          email: store.user.email,
          avatar: store.user.avatar,
          account_status: store.user.account_status,
        }
      : undefined,
  };
}
