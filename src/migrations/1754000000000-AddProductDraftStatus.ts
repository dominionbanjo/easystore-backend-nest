import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductDraftStatus1754000000000 implements MigrationInterface {
  name = 'AddProductDraftStatus1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend the products.status enum with 'draft'
    await queryRunner.query(`
      ALTER TYPE "products_status_enum"
      ADD VALUE IF NOT EXISTS 'draft'
    `);

    // 2. Relax NOT NULL constraints so incomplete drafts can be stored
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "name" DROP NOT NULL,
      ALTER COLUMN "slug" DROP NOT NULL,
      ALTER COLUMN "category_id" DROP NOT NULL,
      ALTER COLUMN "price" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "name" SET NOT NULL,
      ALTER COLUMN "slug" SET NOT NULL,
      ALTER COLUMN "category_id" SET NOT NULL,
      ALTER COLUMN "price" SET NOT NULL
    `);
  }
}
