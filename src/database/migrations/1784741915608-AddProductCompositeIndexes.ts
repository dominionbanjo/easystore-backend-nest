import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCompositeIndexes1784741915608 implements MigrationInterface {
  name = 'AddProductCompositeIndexes1784741915608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Composite index for the main store products query:
    // WHERE store_id = ? AND status = 'active' ORDER BY created_at DESC
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PRODUCT_STORE_STATUS_CREATED"
            ON products (store_id, status, created_at DESC)
        `);

    // Composite index for the category-filtered store products query:
    // WHERE store_id = ? AND category_id = ? AND status = 'active' ORDER BY created_at DESC
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PRODUCT_STORE_CATEGORY_STATUS_CREATED"
            ON products (store_id, category_id, status, created_at DESC)
        `);

    // GIN index for full-text search on search_vector
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PRODUCT_SEARCH_VECTOR"
            ON products USING GIN (search_vector)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PRODUCT_SEARCH_VECTOR"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_PRODUCT_STORE_CATEGORY_STATUS_CREATED"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_PRODUCT_STORE_STATUS_CREATED"`,
    );
  }
}
