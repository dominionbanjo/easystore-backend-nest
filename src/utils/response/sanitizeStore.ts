export interface SanitizedStore {
  id: string;
  store_name: string;
  slug: string;
  logo: string | null;
  cover_image: string | null;
  rating_average: number | null;
  rating_count: number;
  location: string | null;
}

export function sanitizeStore(
  store: SanitizedStore | null | undefined,
): SanitizedStore | null {
  if (!store) return null;

  return {
    id: store.id,
    store_name: store.store_name,
    slug: store.slug,
    logo: store.logo,
    cover_image: store.cover_image,
    rating_average: store.rating_average,
    rating_count: store.rating_count,
    location: store.location,
  };
}
