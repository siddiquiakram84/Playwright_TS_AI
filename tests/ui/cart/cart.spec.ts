import { expect } from '@playwright/test';
import { test } from '../../../fixtures';
import usersData from '../../../test-data/users.json';
import cartsData from '../../../test-data/carts.json';

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

    test('should remove item from cart', async ({ productsPage, cartPage, page }) => {
      await productsPage.navigate();
      await productsPage.addProductToCartByIndex(0);

      const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
      await viewCartBtn.click();

      const initialCount = await cartPage.getCartItemCount();
      await cartPage.removeItem(0);
      await page.waitForTimeout(500);
      const newCount = await cartPage.getCartItemCount();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should show empty cart message when cart is empty', async ({ cartPage }) => {
      await cartPage.navigate();
      await cartPage.assertCartIsEmpty();
    });
  });

  test.describe('Logged-in user', () => {
    test.beforeEach(async ({ loginPage, page }) => {
      await loginPage.navigate();
      await loginPage.login(usersData.validLogin.email, usersData.validLogin.password);
      await expect(page).toHaveURL('/');
    });

    test('should proceed to checkout from cart', async ({ productsPage, cartPage, page }) => {
      await productsPage.navigate();
      await productsPage.addProductToCartByIndex(0);

      const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
      await viewCartBtn.click();

      await cartPage.proceedToCheckout();
      await expect(page).toHaveURL('/checkout');
    });

    test('should complete checkout flow', async ({
      productsPage,
      cartPage,
      checkoutPage,
      page,
    }) => {
      await productsPage.navigate();
      await productsPage.addProductToCartByIndex(0);
      const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
      await viewCartBtn.click();

      await cartPage.proceedToCheckout();
      await checkoutPage.addComment('Test order from automation');
      await checkoutPage.placeOrder();

      await checkoutPage.fillPaymentDetails(
        cartsData.payment.nameOnCard,
        cartsData.payment.cardNumber,
        cartsData.payment.cvc,
        cartsData.payment.expiryMonth,
        cartsData.payment.expiryYear,
      );
      await checkoutPage.confirmPayment();
      await checkoutPage.assertOrderPlaced();
    });
  });
});
