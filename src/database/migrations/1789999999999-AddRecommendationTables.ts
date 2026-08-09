import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationTables1789999999999 implements MigrationInterface {
  name = 'AddRecommendationTables1789999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Explicit user shopping preferences (category interests)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_preferences" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "category_ids" text array NOT NULL DEFAULT ARRAY[]::text[],
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_preferences" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_USER_PREFERENCE_USER_ID"
            ON "user_preferences" ("user_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "user_preferences"
            ADD CONSTRAINT "FK_user_preferences_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        `);

    // Buyer purchase-history index for recommendation signal collection
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_ORDER_BUYER_ID"
            ON "orders" ("buyer_id")
        `);

    // Collaborative-filtering index on verified purchases
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_PRODUCT_CUSTOMER_USER_ID"
            ON "product_customers" ("user_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_PRODUCT_CUSTOMER_USER_ID"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_BUYER_ID"`);
    await queryRunner.query(
      `ALTER TABLE "user_preferences" DROP CONSTRAINT IF EXISTS "FK_user_preferences_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_USER_PREFERENCE_USER_ID"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences"`);
  }
}
