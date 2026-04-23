/**
 * Self-Healing Locator Demo
 *
 * Demonstrates feature 2: AI finds the correct selector when the original breaks.
 * The test intentionally uses wrong selectors — the SelfHealingLocator detects
 * the failure, asks the AI for alternatives, and recovers automatically.
 */
import { expect } from '@playwright/test';
import { test }   from '../../../core/fixtures';

test.describe('GenAI: Self-Healing Locators', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
  });

  test('heals a broken email-field selector and completes login flow', async ({ aiPage, page }) => {
    await aiPage.navigate(`${process.env.UI_BASE_URL}/login`);

    // One deliberately broken selector — AI heals it.
    // Using correct selectors for the other fields keeps this test to a single AI call
    // so it finishes within the CPU-inference budget (~5 min for mistral on this hardware).
    const emailField    = aiPage.locator('[data-qa="login-email-BROKEN"]'); // healed by AI
    const passwordField = aiPage.locator('[data-qa="login-password"]');      // correct
    const loginButton   = aiPage.locator('[data-qa="login-button"]');        // correct

    await emailField.fill(process.env.TEST_USER_EMAIL ?? 'test@example.com');
    await passwordField.fill(process.env.TEST_USER_PASSWORD ?? 'Test@1234');
    await loginButton.click();

    console.log(`\n  Self-healing report:`);
    console.log(`    Email field healed : ${emailField.isHealed} (${emailField.selector})`);

    expect(emailField.isHealed).toBe(true);
  });

  test('reuses cached healed selector on second invocation (no AI call)', async ({ aiPage }) => {
    await aiPage.navigate(`${process.env.UI_BASE_URL}/login`);

    // Same broken selector as above — should resolve from cache this run
    const emailField = aiPage.locator('[data-qa="login-email-BROKEN"]');
    await emailField.fill('cached@example.com');

    // If the cache works, the fill succeeds without an AI call
    const value = await aiPage.native.locator(emailField.selector).inputValue();
    expect(value).toBe('cached@example.com');
  });

  test('self-healing page exposes the underlying Playwright Page via .native', async ({ aiPage }) => {
    await aiPage.navigate(`${process.env.UI_BASE_URL}/login`);
    const title = await aiPage.native.title();
    expect(title).toBeTruthy();
    expect(typeof title).toBe('string');
  });
});
