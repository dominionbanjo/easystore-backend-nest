import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreIdToOrders1784660608032 implements MigrationInterface {
  name = 'AddStoreIdToOrders1784660608032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "store_id" uuid NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_STORE_ID" ON "orders" ("store_id")`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_orders_store') THEN ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_store" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL; END IF; END $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_store"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_STORE_ID"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "store_id"`,
    );
  }
}
