import { expect } from '@playwright/test';
import { test } from '../../../../core/fixtures';

test.describe('Product Listing', () => {
  test.beforeEach(async ({ productsPage }) => {
    await productsPage.navigate();
  });

  test('should display all products heading', async ({ productsPage }) => {
    await expect(productsPage.allProductsHeading).toBeVisible();
  });

  test('should display product cards with names and prices', async ({ productsPage }) => {
    const count = await productsPage.getProductCount();
    expect(count).toBeGreaterThan(0);
    const names = await productsPage.getProductNames();
    expect(names.length).toBeGreaterThan(0);
    names.forEach(name => expect(name.length).toBeGreaterThan(0));
  });

  test('should add product to cart from listing page', async ({ productsPage, page }) => {
    await productsPage.addProductToCartByIndex(0);
    const continueShoppingBtn = page.locator('button').filter({ hasText: 'Continue Shopping' });
    const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
    await expect(continueShoppingBtn.or(viewCartBtn)).toBeVisible();
  });
});
