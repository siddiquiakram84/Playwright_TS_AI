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

});
