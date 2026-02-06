import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutOfStockFlag1707240000000 implements MigrationInterface {
  name = 'AddOutOfStockFlag1707240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the generated column
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "is_out_of_stock" BOOLEAN 
      GENERATED ALWAYS AS (stock < 1) STORED
    `);

    // 2. Add an index for faster filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_PRODUCT_OUT_OF_STOCK" 
      ON "products"("is_out_of_stock")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_PRODUCT_OUT_OF_STOCK"
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "is_out_of_stock"
    `);
  }
}
