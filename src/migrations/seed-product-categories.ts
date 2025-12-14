import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuid } from 'uuid';

export class SeedProductCategories1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper to insert category if it does not exist
    const insertCategory = async (
      name: string,
      slug: string,
      parentId: string | null = null,
    ) => {
      await queryRunner.query(
        `
        INSERT INTO product_categories (id, name, slug, parent_id)
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (
          SELECT 1 FROM product_categories WHERE slug = $3
        )
        `,
        [uuid(), name, slug, parentId],
      );
    };

    /* ───────────────── ROOT CATEGORIES ───────────────── */

    const roots = [
      'electronics',
      'fashion',
      'home-living',
      'beauty-personal-care',
      'health-wellness',
      'sports-outdoors',
      'baby-kids',
      'groceries',
      'automotive',
      'books-media',
      'office-stationery',
    ];

    for (const slug of roots) {
      await insertCategory(
        slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        slug,
      );
    }

    /* ───────────────── SUBCATEGORIES ───────────────── */

    const parentMap = await queryRunner.query(
      `SELECT id, slug FROM product_categories WHERE parent_id IS NULL`,
    );

    const parents: Record<string, string> = {};
    for (const p of parentMap) parents[p.slug] = p.id;

    const subs: Record<string, string[]> = {
      electronics: [
        'phones-tablets',
        'laptops-computers',
        'accessories',
        'tvs-audio',
        'gaming',
      ],
      fashion: ['men', 'women', 'shoes', 'bags-accessories'],
      'home-living': [
        'furniture',
        'kitchen',
        'bedding',
        'home-decor',
        'appliances',
      ],
      'beauty-personal-care': [
        'skincare',
        'makeup',
        'hair-care',
        'fragrance',
        'grooming',
      ],
      'health-wellness': [
        'supplements',
        'medical-supplies',
        'fitness-equipment',
      ],
      'sports-outdoors': ['sportswear', 'outdoor-gear', 'fitness-accessories'],
      'baby-kids': ['baby-clothing', 'toys', 'school-supplies'],
      groceries: ['beverages', 'snacks', 'fresh-food', 'household-essentials'],
      automotive: [
        'car-accessories',
        'motorbike-accessories',
        'tools-equipment',
      ],
      'books-media': ['books', 'e-books', 'music', 'movies'],
      'office-stationery': [
        'office-furniture',
        'writing-supplies',
        'printers-ink',
      ],
    };

    for (const [parentSlug, children] of Object.entries(subs)) {
      const parentId = parents[parentSlug];
      if (!parentId) continue;

      for (const child of children) {
        await insertCategory(
          child.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          child,
          parentId,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM product_categories`);
  }
}
