import { expect } from '@playwright/test';
import { test } from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { userSchema } from '../../api/schemas/user.schema';
import { User } from '../../api/types';
import usersData from '../../test-data/users.json';

test.describe('Users API', () => {
  test('GET /users - should return array of users', async ({ usersClient }) => {
    const users = await usersClient.getAll();
    expect(users.length).toBeGreaterThan(0);
    users.forEach(u => validateSchema<User>(u, userSchema));
  });

  test('GET /users/:id - should return user with valid schema', async ({ usersClient }) => {
    const user = await usersClient.getById(1);
    validateSchema<User>(user, userSchema);
    expect(user.id).toBe(1);
    expect(typeof user.email).toBe('string');
    expect(user.email).toContain('@');
  });

});
