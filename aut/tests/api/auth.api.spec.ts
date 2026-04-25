/**
 * Auth API — Contract + Integration Tests
 *
 * Coverage:
 *   TC-AUTH-001  Valid credentials → non-empty JWT, response time within SLA
 *   TC-AUTH-002  Invalid credentials → 400 [data-driven, 3 scenarios]
 *   TC-AUTH-003  Token accepted by downstream endpoints
 *
 * Sensitive credentials come from ENV (process.env / .env file).
 * Error-scenario test data lives in test-data/api/auth.data.json.
 *
 * Bug fixed: previous spec hard-coded credentials and used a raw hardcoded URL
 * for the negative test, bypassing ENV config entirely.
 */

import { expect } from '@playwright/test';
import { test }   from '../../../core/fixtures';
import { ENV }    from '../../../core/utils/envConfig';
import {
  HttpStatus,
  ResponseTimeLimit,
  TokenConstraints,
} from '../../constants';
import authData from '../../test-data/api/auth.data.json';

// ── Allure annotation helper ──────────────────────────────────────────────────

function tag(testId: string, epic: string, feature: string, severity: string): void {
  test.info().annotations.push(
    { type: 'testId',   description: testId   },
    { type: 'epic',     description: epic     },
    { type: 'feature',  description: feature  },
    { type: 'severity', description: severity },
    { type: 'tag',      description: 'api'    },
    { type: 'tag',      description: 'auth'   },
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Auth API — POST /auth/login', () => {

  // TC-AUTH-001 ────────────────────────────────────────────────────────────────
  test('TC-AUTH-001 | valid credentials return non-empty JWT token', async ({ authClient }) => {
    tag('TC-AUTH-001', 'Authentication', 'POST /auth/login', 'critical');

    const result = await authClient.login({
      username: ENV.apiUsername,  // ← from .env, never hard-coded
      password: ENV.apiPassword,
    });

    expect(result.token,               'token field must be present').toBeTruthy();
    expect(typeof result.token,        'token must be a string').toBe('string');
    expect(result.token.length,        `token length must exceed ${TokenConstraints.MIN_LENGTH}`)
      .toBeGreaterThan(TokenConstraints.MIN_LENGTH);

    // SLA: password hashing → allow SLOW threshold (3 000 ms)
    expect(
      authClient.lastResponseTimeMs,
      `response time must be < ${ResponseTimeLimit.SLOW}ms`,
    ).toBeLessThan(ResponseTimeLimit.SLOW);
  });

  // TC-AUTH-002 — data-driven: one test per invalid-credential scenario ────────
  for (const tc of authData.invalidCredentials) {
    test(`TC-AUTH-002 | invalid credentials [${tc.scenario}] → HTTP ${tc.expectedStatus}`, async ({
      request,
    }) => {
      tag('TC-AUTH-002', 'Authentication', 'POST /auth/login — error paths', 'high');
      test.info().annotations.push({ type: 'scenario', description: tc.scenario });

      // Raw request: BaseApiClient.sendRaw could also be used, but using request
      // directly is clearer when we intentionally assert on a non-2xx status.
      const res = await request.post(`${ENV.apiBaseUrl}/auth/login`, {
        data:    { username: tc.username, password: tc.password },
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });

      expect(
        res.status(),
        `[${tc.scenario}] expected HTTP ${tc.expectedStatus}`,
      ).toBe(tc.expectedStatus);

      expect(res.ok(), `[${tc.scenario}] response.ok must be false`).toBe(false);
    });
  }

  // TC-AUTH-003 ────────────────────────────────────────────────────────────────
  test('TC-AUTH-003 | acquired token is accepted by downstream endpoints', async ({
    authClient,
    productsClient,
  }) => {
    tag('TC-AUTH-003', 'Authentication', 'Token propagation', 'high');

    const token = await authClient.loginAndSetToken({
      username: ENV.apiUsername,
      password: ENV.apiPassword,
    });

    expect(token, 'loginAndSetToken must return non-empty token').toBeTruthy();

    productsClient.setAuthToken(token);
    const products = await productsClient.getAll(1);

    expect(products, 'products endpoint must succeed with valid token').toHaveLength(1);
    expect(authClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.SLOW);
  });
});
