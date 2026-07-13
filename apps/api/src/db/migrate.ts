import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { getConfig } from '../config.js';

export async function runMigrations(): Promise<void> {
  const config = getConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });

  const db = drizzle(pool);

  console.log('Running database migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
