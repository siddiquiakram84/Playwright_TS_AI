import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT ?? '30000');
const API_TIMEOUT     = parseInt(process.env.API_TIMEOUT     ?? '15000');
const AI_TIMEOUT      = parseInt(process.env.AI_TIMEOUT      ?? '120000');
const HEADLESS        = process.env.HEADED !== 'true';

export default defineConfig({
  testDir: './aut/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: DEFAULT_TIMEOUT,

  reporter: [
    ['list'],
    ['json', { outputFile: 'dashboard/playwright/test-results/results.json' }],
    ['html', { outputFolder: 'dashboard/playwright/report', open: 'never' }],
    ['allure-playwright', {
      detail: true,
      resultsDir: process.env.ALLURE_RESULTS_DIR ?? 'dashboard/allure/results',
      suiteTitle: false,
    }],
  ],

  use: {
    baseURL: process.env.UI_BASE_URL,
    headless: HEADLESS,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    // ── UI: Chrome (Chromium) ────────────────────────────────────────────────
    {
      name: 'ui',
      testDir: './aut/tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },

    // ── UI: Firefox ──────────────────────────────────────────────────────────
    {
      name: 'ui-firefox',
      testDir: './aut/tests/ui',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
      },
    },

    // ── UI: Safari / WebKit ──────────────────────────────────────────────────
    {
      name: 'ui-webkit',
      testDir: './aut/tests/ui',
      use: {
        ...devices['Desktop Safari'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
      },
    },

    // ── UI: Microsoft Edge ───────────────────────────────────────────────────
    {
      name: 'ui-edge',
      testDir: './aut/tests/ui',
      use: {
        ...devices['Desktop Edge'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },

    // ── API ──────────────────────────────────────────────────────────────────
    {
      name: 'api',
      testDir: './aut/tests/api',
      use: {
        baseURL: process.env.API_BASE_URL,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        actionTimeout: API_TIMEOUT,
      },
    },

    // ── Hybrid ───────────────────────────────────────────────────────────────
    {
      name: 'hybrid',
      testDir: './aut/tests/hybrid',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
      },
    },

    // ── GenAI Superpowers ────────────────────────────────────────────────────
    {
      name: 'ai',
      testDir: './aut/tests/ai',
      timeout: AI_TIMEOUT,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.UI_BASE_URL,
        viewport: { width: 1280, height: 720 },
        actionTimeout:     AI_TIMEOUT,
        navigationTimeout: AI_TIMEOUT,
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
  ],

  outputDir: 'dashboard/playwright/test-results',
});
