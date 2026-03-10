import dotenv from 'dotenv';
import path from 'path';
// Use absolute path so this works regardless of the process CWD
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const getEnvVar = (name: string, defaultValue?: string): string => {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
};

// Build a PostgreSQL connection string from individual DB_* vars.
// Used when DATABASE_URL is not set directly (e.g. container / server deployments
// that expose DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME separately).
const resolveDbUrl = (): string => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host     = process.env.DB_HOST     || 'localhost';
  const port     = process.env.DB_PORT     || '5432';
  const user     = encodeURIComponent(process.env.DB_USER     || 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD || 'password');
  const name     = process.env.DB_NAME     || 'password_management';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
};

export const env = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVar('PORT', '5000'), 10),
  // Accepts either DATABASE_URL or individual DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
  DATABASE_URL: resolveDbUrl(),
  // SSL — set DB_SSL=true when the PostgreSQL server requires it (e.g. managed cloud DBs)
  DB_SSL: (process.env.DB_SSL ?? 'false') === 'true',
  JWT_SECRET: getEnvVar('JWT_SECRET', 'dev-secret-change-in-production-min-32-chars-abc'),
  JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production-min-32'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
  FRONTEND_URL: getEnvVar('FRONTEND_URL', 'http://localhost:5173'),
  BCRYPT_ROUNDS: parseInt(getEnvVar('BCRYPT_ROUNDS', '12'), 10),
  // Microsoft SSO (Azure AD / Microsoft Entra ID)
  MICROSOFT_CLIENT_ID: getEnvVar('MICROSOFT_CLIENT_ID', ''),
  MICROSOFT_CLIENT_SECRET: getEnvVar('MICROSOFT_CLIENT_SECRET', ''),
  MICROSOFT_REDIRECT_URI: getEnvVar('MICROSOFT_REDIRECT_URI', 'http://localhost:5000/api/v1/auth/oauth/microsoft/callback'),
};
