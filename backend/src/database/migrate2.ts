import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { env } from '../config/env';

const runMigration = async () => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  });

  try {
    const sqlFile = path.join(__dirname, 'migrations', '002_security.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('Running security migration (002)...');
    await pool.query(sql);
    console.log('Security migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
