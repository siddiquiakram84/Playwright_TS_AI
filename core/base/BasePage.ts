import { Page, Locator, expect } from '@playwright/test';
import { logger } from '../utils/logger';
import { SelfHealingLocator } from '../ai/SelfHealingLocator';
import { AIClient } from '../ai/AIClient';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract get url(): string;

  /**
   * Returns a self-healing locator for selectors that may be unstable across
   * deployments. On first failure the AI analyses the live DOM and caches
   * the healed selector — subsequent calls use the cache (no AI cost).
   * Use this for any locator defined by class/position rather than data-qa.
   */
  protected healingLocator(selector: string): SelfHealingLocator {
    return new SelfHealingLocator(this.page, selector, AIClient.getInstance());
  }

  async navigate(): Promise<void> {
    logger.info(`Navigating to ${this.url}`);
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async isElementVisible(locator: Locator, timeout = 5000): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async scrollToElement(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  async clearAndType(locator: Locator, text: string): Promise<void> {
    await locator.clear();
    await locator.fill(text);
  }

  async assertVisible(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeVisible();
  }

  async assertText(locator: Locator, expected: string): Promise<void> {
    await expect(locator).toHaveText(expected);
  }

  async assertUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
