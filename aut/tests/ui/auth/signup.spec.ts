import { expect } from '@playwright/test';
import { test } from '../../../../core/fixtures';
import { randomEmail } from '../../../../core/utils/helpers';
import usersData from '../../../test-data/users.json';
import { SignupFormData } from '../../../pages/SignupPage';

test.describe('Signup', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.navigate();
  });

  test('should register a new user successfully', async ({
    loginPage,
    signupPage,
    homePage,
    page,
  }) => {
    const email = randomEmail('signup');
    const { newUser } = usersData;

    await loginPage.initiateSignup(newUser.name, email);
    await expect(page).toHaveURL('/signup');
    await expect(signupPage.accountInfoHeading).toBeVisible();

    const formData: SignupFormData = {
      title: newUser.title as 'Mr' | 'Mrs',
      password: newUser.password,
      birthDay: newUser.birthDay,
      birthMonth: newUser.birthMonth,
      birthYear: newUser.birthYear,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      address: newUser.address,
      country: newUser.country,
      state: newUser.state,
      city: newUser.city,
      zipcode: newUser.zipcode,
      mobileNumber: newUser.mobileNumber,
    };

    await signupPage.fillAccountInfo(formData);
    await signupPage.fillAddressInfo(formData);
    await signupPage.submit();

    await signupPage.assertAccountCreated();
    await signupPage.continueAfterCreation();
    await expect(homePage.loggedInUser).toBeVisible();
  });

  test('should show error for already registered email', async ({ loginPage }) => {
    await loginPage.initiateSignup('Test User', usersData.validLogin.email);
    await loginPage.assertSignupError('Email Address already exist!');
  });
});
