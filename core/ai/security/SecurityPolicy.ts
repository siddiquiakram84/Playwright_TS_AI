/**
 * Enterprise LLM Security Policy
 *
 * Defines what data is safe to share with LLMs and enforces
 * compliance checkpoints before any call is made.
 *
 * Policy aligns with:
 *  - OWASP LLM Top 10 (LLM01–LLM10)
 *  - NIST AI RMF 1.0
 *  - SOC 2 Type II data handling requirements
 */

// ── What MAY be sent to an LLM ────────────────────────────────────────────────

export const ALLOWED_CONTEXT = [
  'Test step descriptions (no credentials)',
  'Page HTML structure (scrubbed of user data)',
  'Selector patterns and POM method names',
  'Error messages from test runs (no stack traces with system paths)',
  'Public API schema definitions',
  'Non-production test data (fake names, fake emails)',
] as const;

// ── What MUST NEVER be sent to an LLM ────────────────────────────────────────

export const BLOCKED_CONTENT = [
  'Real user credentials (emails, passwords)',
  'API keys, bearer tokens, JWTs',
  'Production database connection strings',
  'AWS/GCP/Azure access keys',
  'Customer PII (names, emails, credit cards)',
  'Internal network topology (hostnames, IPs)',
  'Source code from proprietary business logic (only test layer)',
  'CI/CD secrets or deployment tokens',
] as const;

// ── Codebase indexing scope — safe perimeter ──────────────────────────────────

export const INDEXABLE_PATHS = [
  'aut/tests',          // test specs — public intent, no secrets
  'core/ai/agents',     // agent logic — no secrets
  'core/pages',         // POM definitions — selectors only
  'core/fixtures',      // fixture wiring — no secrets
  'aut/api/schemas',    // schema definitions — structural only
] as const;

export const NON_INDEXABLE_PATHS = [
  '.env',               // secrets
  '.env.*',             // all env variants
  'node_modules',       // vendor code
  '**/*.key',           // private keys
  '**/*.pem',           // certificates
  'dashboard/ai-ops/aiops.db',  // runtime DB with usage data
] as const;

// ── Runtime compliance check ──────────────────────────────────────────────────

export interface ComplianceCheckResult {
  compliant: boolean;
  violations: string[];
  warnings:  string[];
}

export function checkCompliance(): ComplianceCheckResult {
  const violations: string[] = [];
  const warnings:  string[] = [];

  // ADMIN_SECRET must not be default
  if ((process.env.ADMIN_SECRET ?? 'changeme') === 'changeme') {
    warnings.push('ADMIN_SECRET is using the default value — set a strong secret in .env');
  }

  // AI_PROVIDER should be explicit
  if (!process.env.AI_PROVIDER) {
    warnings.push('AI_PROVIDER not set — defaulting to local (Ollama). Set explicitly in .env');
  }

  // If using Anthropic, key must be set
  if (process.env.AI_PROVIDER === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    violations.push('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set');
  }

  // LangSmith tracing enabled but no project set is a data-hygiene issue
  if (process.env.LANGCHAIN_TRACING_V2 === 'true' && !process.env.LANGCHAIN_PROJECT) {
    warnings.push('LangSmith tracing is enabled but LANGCHAIN_PROJECT is not set — traces go to default project');
  }

  return {
    compliant:  violations.length === 0,
    violations,
    warnings,
  };
}

// ── Data classification labels ────────────────────────────────────────────────

export type DataClass = 'public' | 'internal' | 'confidential' | 'restricted';

export function classifyContent(content: string): DataClass {
  // Restricted: contains clear credentials or key patterns
  if (/sk-ant-|Bearer\s+ey|AKIA[A-Z0-9]{16}|password\s*[:=]/i.test(content)) {
    return 'restricted';
  }
  // Confidential: absolute paths, internal hostnames
  if (/\/home\/[a-z]+\/|localhost:\d{4}|192\.168\.|10\.\d+\.\d+/i.test(content)) {
    return 'confidential';
  }
  // Internal: test code, stack traces
  if (/at\s+\w+\s+\(.*:\d+:\d+\)|\.spec\.ts:|core\/pages\//i.test(content)) {
    return 'internal';
  }
  return 'public';
}
