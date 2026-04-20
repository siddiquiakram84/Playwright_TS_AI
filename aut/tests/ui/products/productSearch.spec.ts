import { expect } from '@playwright/test';
import { test } from '../../../../core/fixtures';
import productsData from '../../../test-data/products.json';

test.describe('Product Search', () => {
  test.beforeEach(async ({ productsPage }) => {
    await productsPage.navigate();
  });

  for (const { keyword, expectedMinResults } of productsData.searchKeywords) {
    test(`should return results for keyword: "${keyword}"`, async ({ productsPage }) => {
      await productsPage.searchProduct(keyword);
      await expect(productsPage.searchedProductsHeading).toBeVisible();
      const count = await productsPage.getProductCount();
      expect(count).toBeGreaterThanOrEqual(expectedMinResults);
    });
  }

  test('should return empty results for unknown keyword', async ({ productsPage, page }) => {
    await productsPage.searchProduct('zzz_no_match_xyz_999');
    await expect(productsPage.searchedProductsHeading).toBeVisible();
    const count = await productsPage.getProductCount();
    expect(count).toBe(0);
  });

  test('should clear search and show all products', async ({ productsPage }) => {
    await productsPage.searchProduct('Top');
    const searchCount = await productsPage.getProductCount();
    await productsPage.navigate();
    const allCount = await productsPage.getProductCount();
    expect(allCount).toBeGreaterThanOrEqual(searchCount);
  });
});
