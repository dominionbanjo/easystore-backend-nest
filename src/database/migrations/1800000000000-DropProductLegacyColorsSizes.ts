import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropProductLegacyColorsSizes1800000000000
  implements MigrationInterface
{
  name = 'DropProductLegacyColorsSizes1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Raw colors/sizes columns removed — product colors and sizes now live
    // exclusively in product options + variant combinations.
    await queryRunner.query(
      `ALTER TABLE products DROP COLUMN IF EXISTS colors`,
    );
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS sizes`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS colors text[]`,
    );
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes text[]`,
    );
  }
}
