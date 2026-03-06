import dotenv from 'dotenv';
dotenv.config();

const getEnvVar = (name: string, defaultValue?: string): string => {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
};

export const env = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: parseInt(getEnvVar('PORT', '5000'), 10),
  DATABASE_URL: getEnvVar('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/password_management'),
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
