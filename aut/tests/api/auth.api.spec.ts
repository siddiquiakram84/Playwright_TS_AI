import { expect } from '@playwright/test';
import { test } from '../../../core/fixtures';

test.describe('Auth API', () => {
  test('POST /auth/login - should return JWT token with valid credentials', async ({
    authClient,
  }) => {
    const response = await authClient.login({ username: 'johnd', password: 'm38rmF$' });
    expect(response.token).toBeTruthy();
    expect(typeof response.token).toBe('string');
    expect(response.token.length).toBeGreaterThan(10);
  });

  test('POST /auth/login - should fail with invalid credentials', async ({ request }) => {
    const response = await request.post('https://fakestoreapi.com/auth/login', {
      data: { username: 'invalid_user_xyz', password: 'wrong_pass' },
    });
    expect(response.ok()).toBe(false);
  });

  test('should use token in subsequent authenticated requests', async ({
    authClient,
    productsClient,
  }) => {
    const token = await authClient.loginAndSetToken({ username: 'johnd', password: 'm38rmF$' });
    expect(token).toBeTruthy();
    productsClient.setAuthToken(token);
    const products = await productsClient.getAll(1);
    expect(products).toHaveLength(1);
  });
});
