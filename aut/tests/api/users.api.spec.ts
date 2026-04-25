/**
 * Users API — Full CRUD + Contract Tests
 *
 * Coverage:
 *   TC-USER-001  GET /users         — full list, schema, count, SLA
 *   TC-USER-002  GET /users/:id     — single user [data-driven × valid IDs]
 *   TC-USER-003  GET /users?limit=N — pagination
 *   TC-USER-004  POST /users        — create user, all fields reflected
 *   TC-USER-005  PUT /users/:id     — full replacement
 *   TC-USER-006  PATCH /users/:id   — partial update
 *   TC-USER-007  DELETE /users/:id  — returns deleted resource
 */

import { expect }         from '@playwright/test';
import { test }           from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { userSchema }     from '../../api/schemas/user.schema';
import { User }           from '../../api/types';
import {
  ResponseTimeLimit,
  UserConstraints,
} from '../../constants';
import usersData from '../../test-data/api/users.data.json';

// ── Allure annotation helper ──────────────────────────────────────────────────

function tag(testId: string, feature: string, severity: string): void {
  test.info().annotations.push(
    { type: 'testId',   description: testId   },
    { type: 'epic',     description: 'Users'  },
    { type: 'feature',  description: feature  },
    { type: 'severity', description: severity },
    { type: 'tag',      description: 'api'    },
    { type: 'tag',      description: 'users'  },
  );
}

const EMAIL_REGEX = new RegExp(usersData.expectedEmailFormat);

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Users API', () => {

  // TC-USER-001 ────────────────────────────────────────────────────────────────
  test('TC-USER-001 | GET /users returns full list with valid schema for each user', async ({
    usersClient,
  }) => {
    tag('TC-USER-001', 'GET /users', 'high');

    const users = await usersClient.getAll();

    expect(users.length, 'must return at least 1 user').toBeGreaterThan(0);
    expect(users.length, `total users must be ${usersData.totalUserCount}`)
      .toBe(usersData.totalUserCount);

    users.forEach((u, i) => {
      validateSchema<User>(u, userSchema);
      expect(u.id,         `users[${i}].id must be ≥ ${UserConstraints.MIN_ID}`).toBeGreaterThanOrEqual(UserConstraints.MIN_ID);
      expect(u.email,      `users[${i}].email must match format`).toMatch(EMAIL_REGEX);
      expect(u.username,   `users[${i}].username must not be empty`).toBeTruthy();
    });

    expect(usersClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.NORMAL);
  });

  // TC-USER-002 — data-driven across valid user IDs ───────────────────────────
  for (const id of usersData.validIds) {
    test(`TC-USER-002 | GET /users/${id} returns correct user with valid schema`, async ({
      usersClient,
    }) => {
      tag('TC-USER-002', `GET /users/:id (id=${id})`, 'high');

      const user = await usersClient.getById(id);

      validateSchema<User>(user, userSchema);
      expect(user.id,    `id must equal requested ${id}`).toBe(id);
      expect(user.email, 'email must match format').toMatch(EMAIL_REGEX);
      expect(user.name.firstname, 'firstname must not be empty').toBeTruthy();
      expect(user.name.lastname,  'lastname must not be empty').toBeTruthy();
      expect(user.address.city,   'address.city must not be empty').toBeTruthy();
      expect(user.phone.length,   'phone must not be empty').toBeGreaterThan(UserConstraints.PHONE_MIN);

      expect(usersClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.FAST);
    });
  }

  // TC-USER-003 ────────────────────────────────────────────────────────────────
  test('TC-USER-003 | GET /users?limit=N returns exactly N users', async ({ usersClient }) => {
    tag('TC-USER-003', 'GET /users — pagination', 'medium');

    for (const limit of [1, 2, 5]) {
      const users = await usersClient.getAll(limit);
      expect(users, `limit=${limit} must return exactly ${limit} users`).toHaveLength(limit);
      users.forEach(u => validateSchema<User>(u, userSchema));
    }
  });

  // TC-USER-004 ────────────────────────────────────────────────────────────────
  test('TC-USER-004 | POST /users creates user and returns with assigned id', async ({
    usersClient,
  }) => {
    tag('TC-USER-004', 'POST /users', 'high');

    const payload = usersData.create;
    const created = await usersClient.create(payload);

    validateSchema<User>(created, userSchema);
    expect(typeof created.id, 'id must be a number').toBe('number');
    expect(created.id, 'id must be > 0').toBeGreaterThan(0);
    expect(created.email,           'email must match payload').toBe(payload.email);
    expect(created.username,        'username must match payload').toBe(payload.username);
    expect(created.name.firstname,  'firstname must match payload').toBe(payload.name.firstname);
    expect(created.name.lastname,   'lastname must match payload').toBe(payload.name.lastname);
    expect(created.address.city,    'address.city must match payload').toBe(payload.address.city);

    expect(usersClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.NORMAL);
  });

  // TC-USER-005 ────────────────────────────────────────────────────────────────
  test('TC-USER-005 | PUT /users/:id fully replaces the user', async ({ usersClient }) => {
    tag('TC-USER-005', 'PUT /users/:id', 'medium');

    const payload = usersData.update.full;
    const updated = await usersClient.update(1, payload);

    validateSchema<User>(updated, userSchema);
    expect(updated.email,    'PUT: email must reflect update').toBe(payload.email);
    expect(updated.username, 'PUT: username must reflect update').toBe(payload.username);
    expect(updated.address.city, 'PUT: city must reflect update').toBe(payload.address.city);
  });

  // TC-USER-006 ────────────────────────────────────────────────────────────────
  test('TC-USER-006 | PATCH /users/:id updates only specified fields', async ({ usersClient }) => {
    tag('TC-USER-006', 'PATCH /users/:id', 'medium');

    const original = await usersClient.getById(1);
    const patch    = usersData.update.partial;

    const updated = await usersClient.partialUpdate(1, patch);

    validateSchema<User>(updated, userSchema);
    expect(updated.email,    'PATCH: email must be updated').toBe(patch.email);
    expect(updated.username, 'PATCH: username must be unchanged').toBe(original.username);
  });

  // TC-USER-007 ────────────────────────────────────────────────────────────────
  test('TC-USER-007 | DELETE /users/:id returns the deleted user', async ({ usersClient }) => {
    tag('TC-USER-007', 'DELETE /users/:id', 'medium');

    const deleted = await usersClient.remove(1);

    expect(deleted, 'deleted resource must be returned').toBeDefined();
    expect(deleted.id, 'returned id must match').toBe(1);
    validateSchema<User>(deleted, userSchema);
  });
});
