import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const ENV = {
  environment: (process.env.ENV ?? 'test') as 'dev' | 'test' | 'prod',
  uiBaseUrl: requireEnv('UI_BASE_URL'),
  apiBaseUrl: requireEnv('API_BASE_URL'),
  testUserEmail: process.env.TEST_USER_EMAIL ?? '',
  testUserPassword: process.env.TEST_USER_PASSWORD ?? '',
  defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT ?? '30000'),
  apiTimeout: parseInt(process.env.API_TIMEOUT ?? '15000'),
  allureResultsDir: process.env.ALLURE_RESULTS_DIR ?? 'allure-results',
} as const;
