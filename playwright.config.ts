import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT ?? '30000');
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT ?? '15000');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: DEFAULT_TIMEOUT,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', {
      detail: true,
      outputFolder: process.env.ALLURE_RESULTS_DIR ?? 'allure-results',
      suiteTitle: false,
    }],
  ],

  use: {
    baseURL: process.env.UI_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'ui-firefox',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: process.env.UI_BASE_URL,
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: process.env.API_BASE_URL,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        actionTimeout: API_TIMEOUT,
      },
    },
    {
      name: 'hybrid',
      testDir: './tests/hybrid',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  outputDir: 'test-results',
});
