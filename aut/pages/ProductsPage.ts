import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base/BasePage';

export class ProductsPage extends BasePage {
  readonly searchInput: Locator;
  readonly searchBtn: Locator;
  readonly searchedProductsHeading: Locator;
  readonly productCards: Locator;
  readonly allProductsHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('#search_product');
    this.searchBtn = page.locator('#submit_search');
    this.searchedProductsHeading = page.locator('h2.title').filter({ hasText: 'Searched Products' });
    this.productCards = page.locator('.productinfo');
    this.allProductsHeading = page.locator('h2.title').filter({ hasText: 'All Products' });
  }

  get url(): string { return '/products'; }

  async searchProduct(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.searchBtn.click();
  }

  async getProductCount(): Promise<number> { return this.productCards.count(); }

  async getProductNames(): Promise<string[]> {
    const names = await this.productCards.locator('p').allTextContents();
    return names.map(n => n.trim()).filter(Boolean);
  }

  async clickViewProduct(index = 0): Promise<void> {
    await this.page
      .locator('.product-image-wrapper')
      .nth(index)
      .locator('a[href*="/product_details"]')
      .click();
  }

  async addProductToCartByIndex(index = 0): Promise<void> {
    const card = this.page.locator('.product-image-wrapper').nth(index);
    await card.hover();
    await card.locator('a.add-to-cart').click();
  }

  async assertSearchResultsVisible(): Promise<void> {
    await expect(this.searchedProductsHeading).toBeVisible();
    await expect(this.productCards.first()).toBeVisible();
  }

  async assertAllResultsContain(keyword: string): Promise<void> {
    const names = await this.getProductNames();
    for (const name of names) {
      expect(name.toLowerCase()).toContain(keyword.toLowerCase());
    }
  }
}
