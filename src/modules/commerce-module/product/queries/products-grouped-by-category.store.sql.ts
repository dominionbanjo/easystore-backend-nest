export const STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL = `
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
    p.colors,
    p.sizes,

    -- resolve MAIN category
    COALESCE(pc.id, c.id) AS parent_category_id,

    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(pc.id, c.id)
      ORDER BY p.created_at DESC
    ) AS rn
  FROM products p
  JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN product_categories pc ON pc.id = c.parent_id
  WHERE p.store_id = $1
)
SELECT *
FROM ranked_products
WHERE rn <= $2
ORDER BY parent_category_id, created_at DESC;
`;
