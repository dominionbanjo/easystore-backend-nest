import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixProductCategory1700000000000 implements MigrationInterface {
  name = 'FixProductCategory1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new column
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN category_id uuid
    `);

    // 2. (Optional) Backfill category_id if you had string categories
    // You must adapt this if you want to keep old data
    // Example assumes category.name === old products.category
    await queryRunner.query(`
      UPDATE products p
      SET category_id = c.id
      FROM product_categories c
      WHERE p.category = c.name
    `);

    // 3. Add FK constraint
    await queryRunner.query(`
      ALTER TABLE products
      ADD CONSTRAINT fk_product_category
      FOREIGN KEY (category_id)
      REFERENCES product_categories(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
    `);

    // 4. Drop old column
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN category
    `);

    // 5. Index
    await queryRunner.query(`
      CREATE INDEX IDX_PRODUCT_CATEGORY_ID
      ON products(category_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN category varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE products DROP CONSTRAINT fk_product_category`,
    );
    await queryRunner.query(`ALTER TABLE products DROP COLUMN category_id`);
  }
}
