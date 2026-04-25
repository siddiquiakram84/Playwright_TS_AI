/**
 * Checkout — End-to-End Tests
 *
 * Converted from: test-data/manual-test-cases/checkout-e2e.tc.json
 *
 * Key patterns demonstrated:
 *   ◉ Parametrized data-driven tests — test matrix defined in JSON, iterated here
 *   ◉ Enum assertions — CheckoutMessages.ORDER_PLACED, Routes.LOGIN, etc.
 *   ◉ Sensitive data from ENV only (email, password never in JSON)
 *   ◉ Allure annotations from manual test case IDs
 *   ◉ beforeEach/afterEach isolation — clean session per test
 */

import { expect }   from '@playwright/test';
import { test }     from '../../../../core/fixtures';
import { ENV }      from '../../../../core/utils/envConfig';
import {
  CheckoutMessages,
  LoginMessages,
  CartMessages,
  Routes,
} from '../../../constants';

// ── Card test data (non-sensitive — test card numbers only) ───────────────────

interface CardData {
  label:         string;
  nameOnCard:    string;
  number:        string;
  cvc:           string;
  expiryMonth:   string;
  expiryYear:    string;
}

const CARD_SCENARIOS: CardData[] = [
  {
    label:       'Visa test card',
    nameOnCard:  'Test Automation User',
    number:      '4111111111111111',
    cvc:         '123',
    expiryMonth: '12',
    expiryYear:  '2028',
  },
];

// ── Allure annotation helper ──────────────────────────────────────────────────

function tag(testId: string, feature: string, severity: string, tags: string[]): void {
  test.info().annotations.push(
    { type: 'testId',   description: testId   },
    { type: 'epic',     description: 'E-Commerce Core' },
    { type: 'feature',  description: feature  },
    { type: 'story',    description: 'Checkout Flow'   },
    { type: 'severity', description: severity },
    ...tags.map(t => ({ type: 'tag', description: t })),
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Checkout — End-to-End Flow', () => {

  // TC-CHK-001 — Guest redirect ─────────────────────────────────────────────
  test('TC-CHK-001 | guest user is redirected to login when clicking checkout', async ({
    page,
    cartPage,
  }) => {
    tag('TC-CHK-001', 'Checkout', 'critical', ['checkout', 'auth', 'negative']);

    await cartPage.navigate();
    await page.locator('text=Proceed To Checkout').click();

    await expect(page, 'must redirect to login page').toHaveURL(Routes.LOGIN);
  });

  // TC-CHK-002 — Happy path — parametrized over card scenarios ─────────────
  for (const card of CARD_SCENARIOS) {
    test(`TC-CHK-002 | authenticated checkout with ${card.label}`, async ({
      page,
      loginPage,
      productsPage,
      cartPage,
    }) => {
      tag('TC-CHK-002', 'Checkout', 'critical', ['checkout', 'happy-path', 'smoke']);
      test.info().annotations.push({ type: 'scenario', description: card.label });

      // Arrange: login — credentials from ENV only
      await loginPage.navigate();
      await loginPage.login(ENV.uiUserEmail, ENV.uiUserPassword);
      await expect(page, 'must land on home after login').toHaveURL(Routes.HOME);

      // Arrange: add product to cart
      await productsPage.navigate();
      await productsPage.addProductToCartByIndex(0);
      const continueBtn = page.locator('button', { hasText: CartMessages.CONTINUE_SHOPPING });
      if (await continueBtn.isVisible()) await continueBtn.click();

      // Act: proceed through checkout
      await cartPage.navigate();
      await page.locator('text=Proceed To Checkout').click();
      await page.locator('text=Place Order').click();

      // Fill payment details — test card data from parametrized scenario
      await page.locator('[data-qa="name-on-card"]').fill(card.nameOnCard);
      await page.locator('[data-qa="card-number"]').fill(card.number);
      await page.locator('[data-qa="cvc"]').fill(card.cvc);
      await page.locator('[data-qa="expiry-month"]').fill(card.expiryMonth);
      await page.locator('[data-qa="expiry-year"]').fill(card.expiryYear);
      await page.locator('[data-qa="pay-button"]').click();

      // Assert — enum description: no magic strings in test body
      await expect(
        page.locator('b', { hasText: CheckoutMessages.ORDER_PLACED }),
        `Order confirmation must show "${CheckoutMessages.ORDER_PLACED}"`,
      ).toBeVisible();
    });
  }

  // TC-CHK-003 — Address pre-population ────────────────────────────────────
  test('TC-CHK-003 | checkout page pre-populates delivery address from user profile', async ({
    page,
    loginPage,
    cartPage,
  }) => {
    tag('TC-CHK-003', 'Checkout', 'high', ['checkout', 'address', 'smoke']);

    await loginPage.navigate();
    await loginPage.login(ENV.uiUserEmail, ENV.uiUserPassword);
    await expect(page).toHaveURL(Routes.HOME);

    await cartPage.navigate();
    await page.locator('text=Proceed To Checkout').click();

    // Assert delivery address section is visible (pre-populated from account)
    await expect(
      page.locator('#address_delivery'),
      'Delivery address block must be visible',
    ).toBeVisible();

    const addressText = await page.locator('#address_delivery').textContent();
    expect(addressText, 'address must not be empty').toBeTruthy();
  });
});
