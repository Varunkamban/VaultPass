import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const sqlFile = path.join(__dirname, 'migrations', '003_microsoft_sso.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('Running SSO migration (003_microsoft_sso)...');
    await pool.query(sql);
    console.log('SSO migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
