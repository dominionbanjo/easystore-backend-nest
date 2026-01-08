export function sanitizeStore(store: any) {
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
