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
    s.store_name,

    -- Resolve MAIN category
    COALESCE(pc.id, c.id) AS parent_category_id,

    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(pc.id, c.id)
      ORDER BY p.created_at DESC
    ) AS rn
  FROM products p
  JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN product_categories pc ON pc.id = c.parent_id
  LEFT JOIN stores s ON s.id = p.store_id
)
SELECT *
FROM ranked_products
WHERE rn <= $1
ORDER BY parent_category_id, created_at DESC;
`;
