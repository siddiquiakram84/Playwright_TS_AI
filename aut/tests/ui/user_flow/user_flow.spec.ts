/**
 * User Flow — Critical Path / Smoke Test
 *
 * Covers the full user journey on automationexercise.com:
 *   Login → Browse products → Add to cart → Verify cart
 *
 * Bug fixed: previous file pointed at amazon.in (wrong AUT).
 * This is now the canonical smoke test aligned with the project's AUT.
 */

import { expect } from '@playwright/test';
import { test }   from '../../../../core/fixtures';
import { ENV }    from '../../../../core/utils/envConfig';
import {
  LoginMessages,
  ProductMessages,
  CartMessages,
  Routes,
} from '../../../constants';

test.describe('User Flow — Critical Path', () => {
  test.describe.configure({ mode: 'serial' });

  test('TC-FLOW-001 | login → browse products → add to cart → verify cart count', async ({
    page,
    loginPage,
    homePage,
    productsPage,
    cartPage,
  }) => {
    test.info().annotations.push(
      { type: 'epic',     description: 'User Journey'   },
      { type: 'feature',  description: 'Critical Path'  },
      { type: 'severity', description: 'critical'        },
      { type: 'tag',      description: 'smoke'           },
      { type: 'tag',      description: 'e2e'             },
    );

    // Step 1: Login
    await loginPage.navigate();
    await loginPage.login(ENV.uiUserEmail, ENV.uiUserPassword);

    await expect(page, 'must redirect to home after login').toHaveURL(Routes.HOME);
    await expect(
      homePage.loggedInUser,
      `"${LoginMessages.LOGGED_IN_AS}" banner must be visible`,
    ).toBeVisible();

    // Step 2: Browse products
    await productsPage.navigate();
    await expect(
      page.locator('h2', { hasText: ProductMessages.ALL_PRODUCTS }),
      'products page heading must be visible',
    ).toBeVisible();

    const productCount = await productsPage.getProductCount();
    expect(productCount, 'product listing must contain items').toBeGreaterThan(0);

    // Step 3: Add first product to cart
    await productsPage.addProductToCartByIndex(0);
    const continueBtn = page.locator('button', { hasText: CartMessages.CONTINUE_SHOPPING });
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
    }

    // Step 4: Verify cart
    await cartPage.navigate();
    const cartCount = await cartPage.getCartItemCount();
    expect(cartCount, 'cart must have at least 1 item after adding').toBeGreaterThan(0);
  });
});
