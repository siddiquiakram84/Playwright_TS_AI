import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CartItem {
  name: string;
  price: string;
  quantity: string;
  total: string;
}

export class CartPage extends BasePage {
  readonly cartTable: Locator;
  readonly cartRows: Locator;
  readonly proceedToCheckoutBtn: Locator;
  readonly emptyCartMessage: Locator;
  readonly continueShoppingBtn: Locator;
  readonly modalContinueBtn: Locator;
  readonly modalCheckoutBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.cartTable = page.locator('#cart_info_table');
    this.cartRows = page.locator('tr.cart_menu ~ tr');
    this.proceedToCheckoutBtn = page.locator('.check_out');
    this.emptyCartMessage = page.locator('#empty_cart');
    this.continueShoppingBtn = page.locator('.continue-shopping');
    this.modalContinueBtn = page.locator('#continue-shopping');
    this.modalCheckoutBtn = page.locator('#checkout');
  }

  get url(): string {
    return '/view_cart';
  }

  async getCartItems(): Promise<CartItem[]> {
    const rows = await this.cartRows.all();
    const items: CartItem[] = [];
    for (const row of rows) {
      items.push({
        name: (await row.locator('.cart_description h4 a').textContent())?.trim() ?? '',
        price: (await row.locator('.cart_price p').textContent())?.trim() ?? '',
        quantity: (await row.locator('.cart_quantity button').textContent())?.trim() ?? '',
        total: (await row.locator('.cart_total p').textContent())?.trim() ?? '',
      });
    }
    return items;
  }

  async getCartItemCount(): Promise<number> {
    return this.cartRows.count();
  }

  async removeItem(index = 0): Promise<void> {
    await this.cartRows.nth(index).locator('.cart_delete a').click();
  }

  async proceedToCheckout(): Promise<void> {
    await this.proceedToCheckoutBtn.click();
  }

  async handleAuthModal(action: 'continue' | 'checkout'): Promise<void> {
    if (action === 'continue') {
      await this.modalContinueBtn.click();
    } else {
      await this.modalCheckoutBtn.click();
    }
  }

  async assertCartHasItems(expectedCount: number): Promise<void> {
    await expect(this.cartRows).toHaveCount(expectedCount);
  }

  async assertCartIsEmpty(): Promise<void> {
    await expect(this.emptyCartMessage).toBeVisible();
  }
}
