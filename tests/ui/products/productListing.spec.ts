import { expect } from '@playwright/test';
import { test } from '../../../fixtures';

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

  test('should navigate to product detail page', async ({ productsPage, productDetailPage, page }) => {
    await productsPage.clickViewProduct(0);
    await expect(page).toHaveURL(/product_details/);
    await expect(productDetailPage.productName).toBeVisible();
    await expect(productDetailPage.addToCartBtn).toBeVisible();
  });

  test('should display product detail information', async ({ productsPage, productDetailPage }) => {
    await productsPage.clickViewProduct(0);
    await expect(productDetailPage.productName).not.toBeEmpty();
    await expect(productDetailPage.productPrice).toBeVisible();
    await expect(productDetailPage.productCategory).toBeVisible();
    await expect(productDetailPage.productBrand).toBeVisible();
  });

  test('should add product to cart from listing page', async ({ productsPage, page }) => {
    await productsPage.addProductToCartByIndex(0);
    const continueShoppingBtn = page.locator('button').filter({ hasText: 'Continue Shopping' });
    const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
    await expect(continueShoppingBtn.or(viewCartBtn)).toBeVisible();
  });
});
