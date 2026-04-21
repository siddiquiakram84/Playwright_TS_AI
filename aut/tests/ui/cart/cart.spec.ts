import { expect } from '@playwright/test';
import { test } from '../../../../core/fixtures';

test.describe('Cart', () => {
  test.describe('Guest user', () => {
    test('should add product to cart and verify cart count', async ({
      productsPage,
      cartPage,
      page,
    }) => {
      await productsPage.navigate();
      await productsPage.addProductToCartByIndex(0);

      const continueBtn = page.locator('button').filter({ hasText: 'Continue Shopping' });
      await continueBtn.click();
      await productsPage.addProductToCartByIndex(1);

      const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
      await viewCartBtn.click();
      await expect(page).toHaveURL('/view_cart');
      await cartPage.assertCartHasItems(2);
    });

  });
});
