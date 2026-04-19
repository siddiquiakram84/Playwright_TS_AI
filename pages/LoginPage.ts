import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly loginHeading: Locator;
  readonly loginEmailInput: Locator;
  readonly loginPasswordInput: Locator;
  readonly loginBtn: Locator;
  readonly loginErrorMsg: Locator;

  readonly signupHeading: Locator;
  readonly signupNameInput: Locator;
  readonly signupEmailInput: Locator;
  readonly signupBtn: Locator;
  readonly signupErrorMsg: Locator;

  constructor(page: Page) {
    super(page);
    this.loginHeading = page.locator('h2').filter({ hasText: 'Login to your account' });
    this.loginEmailInput = page.locator('[data-qa="login-email"]');
    this.loginPasswordInput = page.locator('[data-qa="login-password"]');
    this.loginBtn = page.locator('[data-qa="login-button"]');
    this.loginErrorMsg = page.locator('p[style*="color: red"]').first();

    this.signupHeading = page.locator('h2').filter({ hasText: 'New User Signup!' });
    this.signupNameInput = page.locator('[data-qa="signup-name"]');
    this.signupEmailInput = page.locator('[data-qa="signup-email"]');
    this.signupBtn = page.locator('[data-qa="signup-button"]');
    this.signupErrorMsg = page.locator('p[style*="color: red"]').last();
  }

  get url(): string {
    return '/login';
  }

  async login(email: string, password: string): Promise<void> {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
    await this.loginBtn.click();
  }

  async initiateSignup(name: string, email: string): Promise<void> {
    await this.signupNameInput.fill(name);
    await this.signupEmailInput.fill(email);
    await this.signupBtn.click();
  }

  async assertLoginError(expectedText: string): Promise<void> {
    await expect(this.loginErrorMsg).toBeVisible();
    await expect(this.loginErrorMsg).toContainText(expectedText);
  }

  async assertSignupError(expectedText: string): Promise<void> {
    await expect(this.signupErrorMsg).toBeVisible();
    await expect(this.signupErrorMsg).toContainText(expectedText);
  }
}
