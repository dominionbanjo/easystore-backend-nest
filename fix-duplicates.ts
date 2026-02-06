import { DataSource } from 'typeorm';
import 'dotenv/config';

async function fixDuplicates() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await dataSource.initialize();
  console.log('Connected to DB');

  try {
    console.log('Deleting duplicate deliveries...');
    const result = await dataSource.query(`
      DELETE FROM deliveries
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY order_id ORDER BY created_at DESC) as row_num
          FROM deliveries
          WHERE order_id IS NOT NULL
        ) t
        WHERE t.row_num > 1
      );
    `);
    console.log('Duplicates deleted:', result);
  } catch (error) {
    console.error('Error fixing duplicates:', error);
  } finally {
    await dataSource.destroy();
  }
}

fixDuplicates();
