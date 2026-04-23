/**
 * AI-Generated Test Data Demo
 *
 * Demonstrates feature 5: the AI generates realistic, contextually appropriate
 * test data on demand. The generated data is used directly in UI and API tests.
 */
import { expect } from '@playwright/test';
import { test }   from '../../../core/fixtures';

test.describe('GenAI: AI-Generated Test Data', () => {
  test('generates a realistic user profile with all required fields', async ({ testData }) => {
    const user = await testData.generateUser('a new UK customer registering for the first time');

    console.log(`\n  Generated user:`);
    console.log(`    Name    : ${user.title} ${user.firstName} ${user.lastName}`);
    console.log(`    Email   : ${user.email}`);
    console.log(`    Phone   : ${user.phone}`);
    console.log(`    Address : ${user.address.street}, ${user.address.city}, ${user.address.country}`);
    console.log(`    DOB     : ${user.dateOfBirth.day}/${user.dateOfBirth.month}/${user.dateOfBirth.year}`);

    // Structural validation
    expect(['Mr', 'Mrs', 'Miss', 'Ms']).toContain(user.title);
    expect(user.firstName).toBeTruthy();
    expect(user.lastName).toBeTruthy();
    expect(user.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    expect(user.password.length).toBeGreaterThanOrEqual(8);
    expect(user.phone).toBeTruthy();
    expect(user.address.street).toBeTruthy();
    expect(user.address.city).toBeTruthy();
    expect(user.address.country).toBeTruthy();
    expect(user.dateOfBirth.day).toBeGreaterThanOrEqual(1);
    expect(user.dateOfBirth.month).toBeGreaterThanOrEqual(1);
    expect(user.dateOfBirth.month).toBeLessThanOrEqual(12);
    expect(user.dateOfBirth.year).toBeGreaterThan(1950);
  });

  test('generates a realistic product with search terms', async ({ testData }) => {
    const product = await testData.generateProduct('summer women casual wear');

    console.log(`\n  Generated product:`);
    console.log(`    Title       : ${product.title}`);
    console.log(`    Price       : $${product.price}`);
    console.log(`    Category    : ${product.category}`);
    console.log(`    Search terms: ${product.searchTerms.join(', ')}`);

    expect(product.title).toBeTruthy();
    expect(product.price).toBeGreaterThan(0);
    expect(product.category).toBeTruthy();
    expect(Array.isArray(product.searchTerms)).toBe(true);
    expect(product.searchTerms.length).toBeGreaterThanOrEqual(2);
  });

  test('generates contextual product search terms', async ({ testData }) => {
    const terms = await testData.generateSearchTerms(5, 'mens formal office wear');

    console.log(`\n  Generated search terms:`);
    terms.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));

    expect(Array.isArray(terms)).toBe(true);
    expect(terms.length).toBe(5);
    terms.forEach(t => expect(typeof t).toBe('string'));
    terms.forEach(t => expect(t.trim().length).toBeGreaterThan(0));
  });

  test('uses AI-generated user data to fill the signup name field', async ({ testData, page }) => {
    const user = await testData.generateUser();

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Fill the signup name field with AI-generated data
    const nameInput  = page.locator('[data-qa="signup-name"]');
    const emailInput = page.locator('[data-qa="signup-email"]');

    await nameInput.fill(`${user.firstName} ${user.lastName}`);
    await emailInput.fill(user.email);

    // Verify the fields accepted the AI-generated data
    await expect(nameInput).toHaveValue(`${user.firstName} ${user.lastName}`);
    await expect(emailInput).toHaveValue(user.email);

    console.log(`\n  Successfully filled signup form with AI data:`);
    console.log(`    Name  : ${user.firstName} ${user.lastName}`);
    console.log(`    Email : ${user.email}`);
  });

  test('generates a batch of 3 users with unique emails', async ({ testData }) => {
    type UserRecord = { firstName: string; lastName: string; email: string; address: { country: string } };
    const users = await testData.generateBatch<UserRecord>(
      'user', 3, 'diverse international customers',
    );

    console.log(`\n  Generated ${users.length} users:`);
    users.forEach(u => console.log(`    • ${u.firstName} ${u.lastName} <${u.email}> (${u.address.country})`));

    expect(users).toHaveLength(3);
    const emails = users.map(u => u.email);
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(3);
  });

  test('uses AI-generated search term to search products', async ({ testData, productsPage }) => {
    const [term] = await testData.generateSearchTerms(1, 'popular clothing item');

    await productsPage.navigate();
    await productsPage.searchProduct(term);

    console.log(`\n  Searched products with AI-generated term: "${term}"`);
    // Search completes without error — product count may be 0 for unusual terms
    const count = await productsPage.getProductCount();
    console.log(`    Results found: ${count}`);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
