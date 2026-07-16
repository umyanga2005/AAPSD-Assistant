import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getConfig } from '../config.js';
import * as schema from './schema.js';

const DEFAULT_PROJECT_ID_1 = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_ID_2 = '00000000-0000-0000-0000-000000000002';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ENV_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
  const config = getConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Seeding database with default projects, environments, and users...');

  // Clear user_integrations table first (to remove broken encrypted tokens)
  await pool.query('TRUNCATE TABLE user_integrations CASCADE;');
  console.log('✅ Cleared broken encrypted integrations');

  // Seed default user
  await pool.query(
    `
    INSERT INTO users (id, email, name, role)
    VALUES ($1, 'isurukarunarathna2050@gmail.com', 'Umayanga Karunarathna', 'administrator')
    ON CONFLICT (email) DO UPDATE SET role = 'administrator', name = EXCLUDED.name;
  `,
    [DEFAULT_USER_ID],
  );
  console.log('✅ Seeded default admin user');

  // Seed Project 1 (default)
  await pool.query(
    `
    INSERT INTO projects (id, name, description)
    VALUES ($1, 'AAPSD Assistant', 'Default project for AAPSD Assistant system')
    ON CONFLICT (id) DO NOTHING;
  `,
    [DEFAULT_PROJECT_ID_1],
  );
  console.log('✅ Seeded project 1 (AAPSD Assistant)');

  // Seed Project 2
  await pool.query(
    `
    INSERT INTO projects (id, name, description)
    VALUES ($1, 'Staging Environment', 'Staging project for Kubernetes testing')
    ON CONFLICT (id) DO NOTHING;
  `,
    [DEFAULT_PROJECT_ID_2],
  );
  console.log('✅ Seeded project 2 (Staging Environment)');

  // Seed default environment for project 1
  await pool.query(
    `
    INSERT INTO environments (id, project_id, name)
    VALUES ($1, $2, 'staging')
    ON CONFLICT (id) DO NOTHING;
  `,
    [DEFAULT_ENV_ID, DEFAULT_PROJECT_ID_1],
  );
  console.log('✅ Seeded default staging environment');

  // Seed project membership for admin user (look up by email, as Firebase creates users with real UUIDs)
  const userResult = await pool.query(
    `SELECT id FROM users WHERE email = 'isurukarunarathna2050@gmail.com' LIMIT 1;`,
  );

  if (userResult.rows.length > 0) {
    const realUserId = userResult.rows[0].id;
    await pool.query(
      `
      INSERT INTO project_members (user_id, project_id, role)
      VALUES ($1, $2, 'administrator'), ($1, $3, 'administrator')
      ON CONFLICT DO NOTHING;
    `,
      [realUserId, DEFAULT_PROJECT_ID_1, DEFAULT_PROJECT_ID_2],
    );
    console.log(`✅ Seeded project memberships for user ${realUserId}`);

    // Also update user role to administrator
    await pool.query(`UPDATE users SET role = 'administrator' WHERE id = $1;`, [realUserId]);
    console.log('✅ Set user role to administrator');
  } else {
    console.log(
      '⚠️  User not found yet — log in to the app first, then run db:seed again to add project memberships.',
    );
  }

  console.log('\n🎉 Database seed complete! System is ready for testing.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
