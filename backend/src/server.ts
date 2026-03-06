import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import pool from './config/database';

const startServer = async () => {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✓ Database connected successfully');
    client.release();

    app.listen(env.PORT, () => {
      console.log(`✓ Server running on http://localhost:${env.PORT}`);
      console.log(`  Environment: ${env.NODE_ENV}`);
      console.log(`  API: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
