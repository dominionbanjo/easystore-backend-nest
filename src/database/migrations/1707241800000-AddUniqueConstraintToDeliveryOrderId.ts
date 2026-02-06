import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToDeliveryOrderId1707241800000 implements MigrationInterface {
  name = 'AddUniqueConstraintToDeliveryOrderId1707241800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint to order_id in deliveries table
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "UQ_deliveries_order_id" UNIQUE ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint from order_id in deliveries table
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "UQ_deliveries_order_id"`,
    );
  }
}
