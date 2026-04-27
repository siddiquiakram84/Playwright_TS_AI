/**
 * Responsive UI Testing — Viewport + Zoom Parameterization
 *
 * Tests the AUT across the full VIEWPORT_MATRIX (mobile → 4K, 75%–150% zoom).
 * Each profile applies viewport + CSS zoom, runs DOM overflow checks, and
 * optionally uses AI vision to score layout quality (requires AI_PROVIDER).
 *
 * Run:
 *   npx playwright test --project=responsive
 *   npx playwright test --project=responsive --grep homepage
 *   AI_PROVIDER=anthropic npx playwright test --project=responsive
 */

import { test, expect } from '@playwright/test';
import {
  ResponsiveTester,
  VIEWPORT_MATRIX,
  ViewportProfile,
  ResponsiveResult,
} from '../../../../core/ai/ResponsiveTester';
import { ENV } from '../../../../core/utils/envConfig';

// ── Profile subsets ────────────────────────────────────────────────────────────
// Use VIEWPORT_MATRIX for all, or slice for faster smoke runs.

const MOBILE_ONLY: ViewportProfile[]  = VIEWPORT_MATRIX.filter(p => p.isMobile);
const DESKTOP_ONLY: ViewportProfile[] = VIEWPORT_MATRIX.filter(p => !p.isMobile && p.zoom === 1.0);
const ZOOM_MATRIX: ViewportProfile[]  = VIEWPORT_MATRIX.filter(p => p.zoom !== 1.0);
const FULL_MATRIX: ViewportProfile[]  = VIEWPORT_MATRIX;

// ── Shared assertion helper ────────────────────────────────────────────────────

function assertResult(result: ResponsiveResult): void {
  const criticals = result.issues.filter(i => i.severity === 'critical');

  // No critical overflow on any profile
  expect.soft(result.overflowX, [
    `[${result.profile.name}] Horizontal overflow detected`,
    `URL: ${result.profile.name}`,
    `Viewport: ${result.profile.width}×${result.profile.height} @ ${Math.round(result.profile.zoom * 100)}%`,
  ].join('\n')).toBe(false);

  // Score above minimum acceptable threshold
  expect.soft(result.score, `[${result.profile.name}] Score ${result.score}/100 below threshold`).toBeGreaterThanOrEqual(50);

  // No critical layout breaks
  expect.soft(
    criticals.map(c => `${c.description}${c.element ? ' (' + c.element + ')' : ''}`).join('; '),
    `[${result.profile.name}] Critical issues: ${criticals.length}`,
  ).toBe('');
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Responsive UI — Homepage', () => {
  test.describe.configure({ mode: 'serial' });

  let tester: ResponsiveTester;

  test.beforeAll(() => {
    tester = new ResponsiveTester();
  });

  test('Full viewport matrix — homepage', async ({ page }) => {
    await page.goto(ENV.uiBaseUrl ?? '', { waitUntil: 'domcontentloaded' });

    const results = await tester.runMatrix(page, FULL_MATRIX, 'Homepage');

    // Log summary table
    console.log('\n── Responsive Matrix Results ──────────────────');
    results.forEach(r => {
      const status = r.passed ? '✅' : '❌';
      const zoom   = Math.round(r.profile.zoom * 100);
      console.log(`${status} ${r.profile.name.padEnd(18)} ${String(r.profile.width).padStart(4)}×${r.profile.height} @${zoom}%  score=${r.score}  issues=${r.issues.length}`);
    });
    console.log('────────────────────────────────────────────────');

    for (const result of results) {
      assertResult(result);
    }
  });

  test('Mobile breakpoints — nav and header visible', async ({ page }) => {
    await page.goto(ENV.uiBaseUrl ?? '', { waitUntil: 'domcontentloaded' });

    const results = await tester.runMatrix(page, MOBILE_ONLY, 'Homepage mobile');

    for (const result of results) {
      const { profile } = result;
      // After applying profile, verify key elements are visible
      await tester.applyProfile(page, profile);

      const header = page.locator('header, nav, [class*="header"], [class*="navbar"]').first();
      await expect.soft(header, `[${profile.name}] Header not visible`).toBeVisible();

      assertResult(result);
    }
  });

  test('Zoom levels — 75%, 125%, 150% — no critical breaks', async ({ page }) => {
    await page.goto(ENV.uiBaseUrl ?? '', { waitUntil: 'domcontentloaded' });

    const results = await tester.runMatrix(page, ZOOM_MATRIX, 'Homepage zoom');

    for (const result of results) {
      const zoom = Math.round(result.profile.zoom * 100);
      expect.soft(
        result.overflowX,
        `[${result.profile.name}] Horizontal overflow at ${zoom}% zoom`,
      ).toBe(false);
      assertResult(result);
    }
  });
});

test.describe('Responsive UI — Products Page', () => {
  let tester: ResponsiveTester;

  test.beforeAll(() => {
    tester = new ResponsiveTester();
  });

  test('Desktop + wide viewports — product grid layout', async ({ page }) => {
    await page.goto(`${ENV.uiBaseUrl ?? ''}/products`, { waitUntil: 'domcontentloaded' });

    const results = await tester.runMatrix(page, DESKTOP_ONLY, 'Products');

    for (const result of results) {
      assertResult(result);
    }
  });

  test('Mobile — product cards single column', async ({ page }) => {
    await page.goto(`${ENV.uiBaseUrl ?? ''}/products`, { waitUntil: 'domcontentloaded' });

    const results = await tester.runMatrix(page, MOBILE_ONLY, 'Products mobile');

    for (const result of results) {
      // On mobile the product grid should not overflow
      expect.soft(result.overflowX, `[${result.profile.name}] Product grid overflows on mobile`).toBe(false);
      assertResult(result);
    }
  });
});

test.describe('Responsive UI — Login Page', () => {
  let tester: ResponsiveTester;

  test.beforeAll(() => {
    tester = new ResponsiveTester();
  });

  test('All viewports — login form accessible', async ({ page }) => {
    await page.goto(`${ENV.uiBaseUrl ?? ''}/login`, { waitUntil: 'domcontentloaded' });

    const profiles = [
      ...MOBILE_ONLY,
      DESKTOP_ONLY[0],  // desktop 1280
      ZOOM_MATRIX.find(p => p.zoom === 1.5)!, // 150% zoom stress test
    ].filter(Boolean);

    const results = await tester.runMatrix(page, profiles, 'Login');

    for (const result of results) {
      await tester.applyProfile(page, result.profile);
      // Login form must always be reachable
      const form = page.locator('form, [class*="login"], [class*="form"]').first();
      await expect.soft(form, `[${result.profile.name}] Login form not visible`).toBeVisible();
      assertResult(result);
    }
  });
});
