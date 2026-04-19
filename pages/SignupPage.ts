import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface SignupFormData {
  title: 'Mr' | 'Mrs';
  password: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  firstName: string;
  lastName: string;
  company?: string;
  address: string;
  address2?: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  mobileNumber: string;
}

export class SignupPage extends BasePage {
  readonly accountInfoHeading: Locator;
  readonly titleMr: Locator;
  readonly titleMrs: Locator;
  readonly nameInput: Locator;
  readonly passwordInput: Locator;
  readonly birthDaySelect: Locator;
  readonly birthMonthSelect: Locator;
  readonly birthYearSelect: Locator;
  readonly newsLetterCheckbox: Locator;
  readonly offersCheckbox: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly companyInput: Locator;
  readonly addressInput: Locator;
  readonly address2Input: Locator;
  readonly countrySelect: Locator;
  readonly stateInput: Locator;
  readonly cityInput: Locator;
  readonly zipcodeInput: Locator;
  readonly mobileInput: Locator;
  readonly createAccountBtn: Locator;
  readonly accountCreatedHeading: Locator;
  readonly continueBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.accountInfoHeading = page.locator('h2.title').filter({ hasText: 'Enter Account Information' });
    this.titleMr = page.locator('#id_gender1');
    this.titleMrs = page.locator('#id_gender2');
    this.nameInput = page.locator('[data-qa="name"]');
    this.passwordInput = page.locator('[data-qa="password"]');
    this.birthDaySelect = page.locator('[data-qa="days"]');
    this.birthMonthSelect = page.locator('[data-qa="months"]');
    this.birthYearSelect = page.locator('[data-qa="years"]');
    this.newsLetterCheckbox = page.locator('#newsletter');
    this.offersCheckbox = page.locator('#optin');
    this.firstNameInput = page.locator('[data-qa="first_name"]');
    this.lastNameInput = page.locator('[data-qa="last_name"]');
    this.companyInput = page.locator('[data-qa="company"]');
    this.addressInput = page.locator('[data-qa="address"]');
    this.address2Input = page.locator('[data-qa="address2"]');
    this.countrySelect = page.locator('[data-qa="country"]');
    this.stateInput = page.locator('[data-qa="state"]');
    this.cityInput = page.locator('[data-qa="city"]');
    this.zipcodeInput = page.locator('[data-qa="zipcode"]');
    this.mobileInput = page.locator('[data-qa="mobile_number"]');
    this.createAccountBtn = page.locator('[data-qa="create-account"]');
    this.accountCreatedHeading = page.locator('h2.title').filter({ hasText: 'Account Created!' });
    this.continueBtn = page.locator('[data-qa="continue-button"]');
  }

  get url(): string {
    return '/signup';
  }

  async fillAccountInfo(data: SignupFormData): Promise<void> {
    if (data.title === 'Mr') {
      await this.titleMr.check();
    } else {
      await this.titleMrs.check();
    }
    await this.passwordInput.fill(data.password);
    await this.birthDaySelect.selectOption(data.birthDay);
    await this.birthMonthSelect.selectOption(data.birthMonth);
    await this.birthYearSelect.selectOption(data.birthYear);
  }

  async fillAddressInfo(data: SignupFormData): Promise<void> {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    if (data.company) await this.companyInput.fill(data.company);
    await this.addressInput.fill(data.address);
    if (data.address2) await this.address2Input.fill(data.address2);
    await this.countrySelect.selectOption(data.country);
    await this.stateInput.fill(data.state);
    await this.cityInput.fill(data.city);
    await this.zipcodeInput.fill(data.zipcode);
    await this.mobileInput.fill(data.mobileNumber);
  }

  async submit(): Promise<void> {
    await this.createAccountBtn.click();
  }

  async assertAccountCreated(): Promise<void> {
    await expect(this.accountCreatedHeading).toBeVisible();
  }

  async continueAfterCreation(): Promise<void> {
    await this.continueBtn.click();
  }
}
