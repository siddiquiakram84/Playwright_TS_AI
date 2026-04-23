/**
 * AI-Powered Visual Regression Demo
 *
 * Demonstrates feature 4: the AI compares screenshots against stored baselines
 * and returns a structured diff report. No pixel-diffing libraries needed —
 * the LLM understands visual intent, not just byte differences.
 *
 * Run order matters:
 *   1st run: baselines are captured automatically (result.passed = true by convention)
 *   2nd+ run: comparison against baselines fires and diffs are reported
 */
import { expect } from '@playwright/test';
import { test }   from '../../../core/fixtures';

test.describe('GenAI: Visual Regression', () => {
  test('baseline — capture home page visual reference', async ({ visualTester, page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // let lazy images settle
    await visualTester.captureBaseline('homepage');
    console.log('\n  ✔ Baseline captured: homepage');
  });

  test('baseline — capture products page visual reference', async ({ visualTester, page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await visualTester.captureBaseline('products-listing');
    console.log('\n  ✔ Baseline captured: products-listing');
  });

  test('compare home page against baseline', async ({ visualTester, page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const result = await visualTester.compareWithBaseline('homepage');

    console.log(`\n  Visual comparison — homepage:`);
    console.log(`    Passed    : ${result.passed}`);
    console.log(`    Confidence: ${result.confidence}`);
    console.log(`    Summary   : ${result.summary}`);
    if (result.differences.length > 0) {
      console.log('    Differences:');
      for (const d of result.differences) {
        console.log(`      [${d.severity.toUpperCase()}] ${d.element}: ${d.description}`);
      }
    }

    // High-severity regressions must not exist on an unchanged page
    const highSeverity = result.differences.filter(d => d.severity === 'high');
    expect(highSeverity).toHaveLength(0);
    // confidence === 0 means AI vision was unavailable — skip the confidence gate
    if (result.confidence > 0) {
      expect(result.confidence).toBeGreaterThan(0.5);
    }
  });

  test('compare products page against baseline', async ({ visualTester, page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const result = await visualTester.compareWithBaseline('products-listing');

    console.log(`\n  Visual comparison — products-listing:`);
    console.log(`    Passed    : ${result.passed}`);
    console.log(`    Confidence: ${result.confidence}`);
    console.log(`    Summary   : ${result.summary}`);

    const highSeverity = result.differences.filter(d => d.severity === 'high');
    expect(highSeverity).toHaveLength(0);
  });

  test('detect intentional regression (injected CSS change)', async ({ visualTester, page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Inject a visible regression — invert all colours
    await page.addStyleTag({ content: 'body { filter: invert(100%); }' });
    await page.waitForTimeout(300);

    const result = await visualTester.compareWithBaseline('homepage');

    console.log(`\n  Intentional regression test:`);
    console.log(`    Passed    : ${result.passed}`);
    console.log(`    Differences found: ${result.differences.length}`);

    // The colour inversion is drastic — AI or buffer heuristic must detect at least one difference.
    // If confidence === 0, AI was unavailable and buffer heuristic detected the change instead.
    expect(result.differences.length).toBeGreaterThan(0);
    const anyHighOrMedium = result.differences.some(
      d => d.severity === 'high' || d.severity === 'medium',
    );
    expect(anyHighOrMedium).toBe(true);
    console.log(`    AI confidence: ${result.confidence > 0 ? result.confidence : 'N/A (buffer heuristic used)'}`);
  });
});
