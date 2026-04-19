import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { validateSchema } from '../../utils/schemaValidator';
import { userSchema } from '../../api/schemas/user.schema';
import { User } from '../../api/types';
import usersData from '../../test-data/users.json';

test.describe('Users API', () => {
  test('GET /users - should return array of users', async ({ usersClient }) => {
    const users = await usersClient.getAll();
    expect(users.length).toBeGreaterThan(0);
    users.forEach(u => validateSchema<User>(u, userSchema));
  });

  test('GET /users?limit=3 - should respect limit', async ({ usersClient }) => {
    const users = await usersClient.getAll(3);
    expect(users).toHaveLength(3);
  });

  test('GET /users/:id - should return user with valid schema', async ({ usersClient }) => {
    const user = await usersClient.getById(1);
    validateSchema<User>(user, userSchema);
    expect(user.id).toBe(1);
    expect(typeof user.email).toBe('string');
    expect(user.email).toContain('@');
  });

  test('POST /users - should create a new user', async ({ usersClient }) => {
    const payload = usersData.apiUser;
    const created = await usersClient.create(payload);
    expect(created).toBeDefined();
    expect(typeof created.id).toBe('number');
  });

  test('PUT /users/:id - should fully update a user', async ({ usersClient }) => {
    const payload = usersData.apiUser;
    const updated = await usersClient.update(1, payload);
    expect(updated).toBeDefined();
    expect(updated.username).toBe(payload.username);
  });

  test('PATCH /users/:id - should partially update a user', async ({ usersClient }) => {
    const updated = await usersClient.partialUpdate(1, { email: 'patched@test.com' });
    expect(updated).toBeDefined();
  });

  test('DELETE /users/:id - should delete a user', async ({ usersClient }) => {
    const deleted = await usersClient.remove(1);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(1);
  });

  test('GET /users - all users should have valid email format', async ({ usersClient }) => {
    const users = await usersClient.getAll();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    users.forEach(u => expect(u.email).toMatch(emailRegex));
  });

  test('GET /users - all users should have name object with firstname and lastname', async ({
    usersClient,
  }) => {
    const users = await usersClient.getAll();
    users.forEach(u => {
      expect(u.name).toBeDefined();
      expect(u.name.firstname).toBeTruthy();
      expect(u.name.lastname).toBeTruthy();
    });
  });
});
