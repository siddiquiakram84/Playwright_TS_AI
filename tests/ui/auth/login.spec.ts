import { expect } from '@playwright/test';
import { test } from '../../../fixtures';
import usersData from '../../../test-data/users.json';

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.navigate();
  });

  test('should login successfully with valid credentials', async ({ loginPage, homePage, page }) => {
    await loginPage.login(usersData.validLogin.email, usersData.validLogin.password);
    await expect(page).toHaveURL('/');
    await expect(homePage.loggedInUser).toBeVisible();
  });

  for (const scenario of usersData.invalidLogin) {
    test(`should show error for: ${scenario.scenario}`, async ({ loginPage }) => {
      await loginPage.login(scenario.email, scenario.password);
      await loginPage.assertLoginError(scenario.expectedError);
    });
  }

  test('should navigate to signup form', async ({ loginPage }) => {
    await expect(loginPage.signupHeading).toBeVisible();
    await expect(loginPage.signupNameInput).toBeVisible();
  });

  test('should not allow login with empty credentials', async ({ loginPage, page }) => {
    await loginPage.loginBtn.click();
    await expect(page).toHaveURL('/login');
  });
});
