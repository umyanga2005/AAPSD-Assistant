import { Pool } from 'pg';
import { getConfig } from '../config.js';

async function cleanup() {
  const config = getConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  console.log('Cleaning up table data to resolve migration constraints...');

  // Truncate incidents to allow NOT NULL constraint on project_id
  await pool.query('TRUNCATE TABLE incidents CASCADE;');

  console.log('Cleanup completed successfully.');
  await pool.end();
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
