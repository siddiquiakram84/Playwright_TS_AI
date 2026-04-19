import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly navSignup: Locator;
  readonly navLogin: Locator;
  readonly navLogout: Locator;
  readonly navCart: Locator;
  readonly navProducts: Locator;
  readonly loggedInUser: Locator;
  readonly sliderCarousel: Locator;
  readonly featuredItems: Locator;

  constructor(page: Page) {
    super(page);
    this.navSignup = page.locator('a[href="/login"]').filter({ hasText: 'Signup' });
    this.navLogin = page.locator('a[href="/login"]').filter({ hasText: 'Login' });
    this.navLogout = page.locator('a[href="/logout"]');
    this.navCart = page.locator('a[href="/view_cart"]');
    this.navProducts = page.locator('a[href="/products"]');
    this.loggedInUser = page.locator('a').filter({ hasText: /Logged in as/ });
    this.sliderCarousel = page.locator('#slider');
    this.featuredItems = page.locator('.features_items');
  }

  get url(): string {
    return '/';
  }

  async isLoggedIn(): Promise<boolean> {
    return this.loggedInUser.isVisible();
  }

  async getLoggedInUsername(): Promise<string> {
    const text = await this.loggedInUser.textContent() ?? '';
    return text.replace('Logged in as', '').trim();
  }

  async goToLogin(): Promise<void> {
    await this.navLogin.click();
  }

  async goToSignup(): Promise<void> {
    await this.navSignup.click();
  }

  async goToCart(): Promise<void> {
    await this.navCart.click();
  }

  async goToProducts(): Promise<void> {
    await this.navProducts.click();
  }

  async logout(): Promise<void> {
    await this.navLogout.click();
  }
}
