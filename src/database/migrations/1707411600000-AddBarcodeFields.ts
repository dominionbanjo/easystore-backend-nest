import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBarcodeFields1707411600000 implements MigrationInterface {
  name = 'AddBarcodeFields1707411600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_PRODUCT_BARCODE" ON "products" ("barcode") WHERE "barcode" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_VARIANT_BARCODE" ON "product_variants" ("barcode") WHERE "barcode" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "barcode" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PRODUCT_BARCODE"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "barcode"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_VARIANT_BARCODE"`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "barcode"`,
    );
  }
}
