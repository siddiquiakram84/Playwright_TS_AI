import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base/BasePage';

export class ProductDetailPage extends BasePage {
  readonly productName: Locator;
  readonly productCategory: Locator;
  readonly productPrice: Locator;
  readonly productBrand: Locator;
  readonly quantityInput: Locator;
  readonly addToCartBtn: Locator;
  readonly writeReviewLink: Locator;

  constructor(page: Page) {
    super(page);
    this.productName = page.locator('.product-information h2');
    this.productCategory = page.locator('.product-information p').filter({ hasText: 'Category' });
    this.productPrice = page.locator('.product-information span').filter({ hasText: /Rs\. \d+/ }).first();
    this.productBrand = page.locator('.product-information p').filter({ hasText: 'Brand' });
    this.quantityInput = page.locator('#quantity');
    this.addToCartBtn = page.locator('button.cart');
    this.writeReviewLink = page.locator('a[href="#reviews"]');
  }

  get url(): string { return '/product_details'; }

  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.clear();
    await this.quantityInput.fill(String(quantity));
  }

  async addToCart(): Promise<void> { await this.addToCartBtn.click(); }

  async getProductName(): Promise<string> {
    return (await this.productName.textContent())?.trim() ?? '';
  }

  async getProductPrice(): Promise<string> {
    return (await this.productPrice.textContent())?.trim() ?? '';
  }

  async assertProductDetails(name: string, category: string): Promise<void> {
    await expect(this.productName).toHaveText(name);
    await expect(this.productCategory).toContainText(category);
  }
}
