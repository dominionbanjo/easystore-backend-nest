import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductInstallmentPresets1799999999999
  implements MigrationInterface
{
  name = 'AddProductInstallmentPresets1799999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS installment_presets jsonb NOT NULL DEFAULT '[]'
    `);

    // Backfill from the legacy single-preset column for enabled products.
    await queryRunner.query(`
      UPDATE products
      SET installment_presets = jsonb_build_array(installment_preset_id)
      WHERE installment_enabled = true
        AND installment_preset_id IS NOT NULL
        AND installment_preset_id <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS installment_presets`,
    );
  }
}
