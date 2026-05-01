/**
 * Centralised environment configuration.
 *
 * Priority (highest → lowest):
 *   1. process.env variables  ← CI secrets, .env file
 *   2. Per-environment defaults in URL_MATRIX
 *
 * Sensitive values (credentials, API keys) ONLY come from process.env —
 * never hard-coded in JSON test-data files.
 *
 * URL selection is driven by ENV=dev|test|staging|prod:
 *   test    → automationexercise.com / fakestoreapi.com  (default)
 *   staging → set STAGING_UI_URL / STAGING_API_URL in .env
 *   prod    → set PROD_UI_URL    / PROD_API_URL    in .env
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';
import * as fs     from 'fs';

// Walk up from cwd until we find the project root (contains .env + playwright.config.ts).
// Handles running from dashboard-next/ where process.cwd() != project root.
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'playwright.config.ts'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/** Absolute path to the monorepo root — use this instead of process.cwd() for file I/O. */
export const PROJECT_ROOT = findProjectRoot();

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

// ── Per-environment URL matrix ────────────────────────────────────────────────

type Env = 'dev' | 'test' | 'staging' | 'prod';

const URL_MATRIX: Record<Env, { uiBaseUrl: string; apiBaseUrl: string }> = {
  dev: {
    uiBaseUrl:  process.env.DEV_UI_URL  ?? 'https://automationexercise.com',
    apiBaseUrl: process.env.DEV_API_URL ?? 'https://fakestoreapi.com',
  },
  test: {
    uiBaseUrl:  process.env.TEST_UI_URL  ?? 'https://automationexercise.com',
    apiBaseUrl: process.env.TEST_API_URL ?? 'https://fakestoreapi.com',
  },
  staging: {
    uiBaseUrl:  process.env.STAGING_UI_URL  ?? 'https://automationexercise.com',
    apiBaseUrl: process.env.STAGING_API_URL ?? 'https://fakestoreapi.com',
  },
  prod: {
    uiBaseUrl:  process.env.PROD_UI_URL  ?? 'https://automationexercise.com',
    apiBaseUrl: process.env.PROD_API_URL ?? 'https://fakestoreapi.com',
  },
};

function resolveEnv(): Env {
  const raw = (process.env.ENV ?? 'test').toLowerCase();
  if (['dev', 'test', 'staging', 'prod'].includes(raw)) return raw as Env;
  console.warn(`[envConfig] Unknown ENV="${raw}" — defaulting to "test"`);
  return 'test';
}

const currentEnv = resolveEnv();
const urls = URL_MATRIX[currentEnv];

/** Throws at startup if a required env var is absent — catches misconfig early. */
function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`[envConfig] Required env var "${key}" is not set. Add it to .env`);
  return v;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ── Exported config ───────────────────────────────────────────────────────────

export const ENV = {
  environment: currentEnv,

  // URLs — resolved by ENV; can be overridden individually via UI_BASE_URL / API_BASE_URL
  uiBaseUrl:  process.env.UI_BASE_URL  ?? urls.uiBaseUrl,
  apiBaseUrl: process.env.API_BASE_URL ?? urls.apiBaseUrl,

  // UI test credentials — sensitive, sourced from .env only
  uiUserEmail:    optionalEnv('TEST_USER_EMAIL',    ''),
  uiUserPassword: optionalEnv('TEST_USER_PASSWORD', ''),

  // API test credentials — sensitive, sourced from .env
  // FakeStoreAPI ships with johnd/m38rmF$ as a demo account; override in .env
  apiUsername: optionalEnv('API_USERNAME', 'johnd'),
  apiPassword: optionalEnv('API_PASSWORD', 'm38rmF$'),

  // Timeouts
  defaultTimeout: parseInt(optionalEnv('DEFAULT_TIMEOUT', '30000')),
  apiTimeout:     parseInt(optionalEnv('API_TIMEOUT', '15000')),
  aiTimeout:      parseInt(optionalEnv('AI_TIMEOUT', '120000')),

  // Reporting
  allureResultsDir: optionalEnv('ALLURE_RESULTS_DIR', 'dashboard/allure/results'),

  // AI provider
  aiProvider:        optionalEnv('AI_PROVIDER', 'local') as 'local' | 'anthropic',
  ollamaBaseUrl:     optionalEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
  ollamaModel:       optionalEnv('OLLAMA_MODEL', 'llama3.2'),
  ollamaVisionModel: optionalEnv('OLLAMA_VISION_MODEL', 'llava'),
  anthropicApiKey:   optionalEnv('ANTHROPIC_API_KEY', ''),

  // Jira integration (free Cloud account — REST API v3)
  jiraBaseUrl:      optionalEnv('JIRA_BASE_URL',       ''),
  jiraEmail:        optionalEnv('JIRA_EMAIL',          ''),
  jiraApiToken:     optionalEnv('JIRA_API_TOKEN',      ''),
  jiraProjectQa:    optionalEnv('JIRA_PROJECT_QA',     'SCRUM'),
  jiraProjectOps:   optionalEnv('JIRA_PROJECT_OPS',    'OPS'),
  jiraProjectDev:   optionalEnv('JIRA_PROJECT_DEV',    'DEV'),
  jiraProjectAuto:  optionalEnv('JIRA_PROJECT_AUTO',   'AUTO'),
  jiraAssigneeQa:   optionalEnv('JIRA_ASSIGNEE_QA',    ''),
  jiraAssigneeOps:  optionalEnv('JIRA_ASSIGNEE_OPS',   ''),
  jiraAssigneeDev:  optionalEnv('JIRA_ASSIGNEE_DEV',   ''),
  jiraAssigneeAuto: optionalEnv('JIRA_ASSIGNEE_AUTO',  ''),
} as const;
