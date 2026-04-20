import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base/BasePage';

export class CheckoutPage extends BasePage {
  readonly addressDetails: Locator;
  readonly reviewYourOrder: Locator;
  readonly commentTextarea: Locator;
  readonly placeOrderBtn: Locator;
  readonly nameOnCard: Locator;
  readonly cardNumber: Locator;
  readonly cvc: Locator;
  readonly expiryMonth: Locator;
  readonly expiryYear: Locator;
  readonly payConfirmBtn: Locator;
  readonly orderSuccessHeading: Locator;
  readonly orderSuccessMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.addressDetails = page.locator('#address_delivery');
    this.reviewYourOrder = page.locator('#cart_info');
    this.commentTextarea = page.locator('textarea[name="message"]');
    this.placeOrderBtn = page.locator('a.check_out');
    this.nameOnCard = page.locator('[data-qa="name-on-card"]');
    this.cardNumber = page.locator('[data-qa="card-number"]');
    this.cvc = page.locator('[data-qa="cvc"]');
    this.expiryMonth = page.locator('[data-qa="expiry-month"]');
    this.expiryYear = page.locator('[data-qa="expiry-year"]');
    this.payConfirmBtn = page.locator('[data-qa="pay-button"]');
    this.orderSuccessHeading = page.locator('h2.title').filter({ hasText: 'Order Placed!' });
    this.orderSuccessMessage = page.locator('p').filter({ hasText: 'Congratulations!' });
  }

  get url(): string { return '/checkout'; }

  async addComment(text: string): Promise<void>    { await this.commentTextarea.fill(text); }
  async placeOrder(): Promise<void>                { await this.placeOrderBtn.click(); }
  async confirmPayment(): Promise<void>            { await this.payConfirmBtn.click(); }

  async fillPaymentDetails(cardName: string, cardNum: string, cvc: string, month: string, year: string): Promise<void> {
    await this.nameOnCard.fill(cardName);
    await this.cardNumber.fill(cardNum);
    await this.cvc.fill(cvc);
    await this.expiryMonth.fill(month);
    await this.expiryYear.fill(year);
  }

  async assertOrderPlaced(): Promise<void> {
    await expect(this.orderSuccessHeading).toBeVisible();
  }

  async assertDeliveryAddress(containsText: string): Promise<void> {
    await expect(this.addressDetails).toContainText(containsText);
  }
}
