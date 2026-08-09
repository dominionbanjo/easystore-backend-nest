export const PRODUCTS_GROUPED_BY_CATEGORY_SQL = `
WITH ranked_products AS (
  SELECT
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.stock,
    p.rating_average,
    p.created_at,
    p.image,
    p.on_sale,
    p.options,
    (
      SELECT json_agg(json_build_object(
        'id', v.id,
        'sku', v.sku,
        'combinations', v.combinations,
        'price', v.price,
        'stock', v.stock,
        'discount_price', v.discount_price,
        'image_url', v.image_url
      ))
      FROM product_variants v
      WHERE v.product_id = p.id
    ) as variants,

    s.store_name,
    s.address_city,
    s.address_state,
    s.address_country,
    s.address_postal_code,

    -- Resolve MAIN category
    COALESCE(pc.id, c.id) AS parent_category_id,

    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(pc.id, c.id)
      ORDER BY p.created_at DESC
    ) AS rn
  FROM products p
  JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN product_categories pc ON pc.id = c.parent_id
  JOIN stores s ON s.id = p.store_id
  JOIN users u ON u.id = p.vendor_id
  WHERE p.status = 'active'
    AND s.status = 'active'
    AND u.account_status = 'active'
)
SELECT *
FROM ranked_products
WHERE rn <= $1
ORDER BY parent_category_id, created_at DESC;
`;
