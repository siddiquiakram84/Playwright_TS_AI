/**
 * Carts API — Full CRUD + Contract Tests
 *
 * Coverage:
 *   TC-CART-001  GET /carts         — full list, schema, count, SLA
 *   TC-CART-002  GET /carts/:id     — single cart [data-driven × valid IDs]
 *   TC-CART-003  GET /carts?limit=N — pagination
 *   TC-CART-004  GET /carts?startdate/enddate — date-range filter
 *   TC-CART-005  POST /carts        — create cart, products array validated
 *   TC-CART-006  PUT /carts/:id     — full replacement
 *   TC-CART-007  PATCH /carts/:id   — partial update
 *   TC-CART-008  DELETE /carts/:id  — returns deleted resource
 */

import { expect }         from '@playwright/test';
import { test }           from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { cartSchema }     from '../../api/schemas/cart.schema';
import { Cart }           from '../../api/types';
import {
  ResponseTimeLimit,
  CartConstraints,
  DATE_REGEX,
} from '../../constants';
import cartsData from '../../test-data/api/carts.data.json';

// ── Allure annotation helper ──────────────────────────────────────────────────

function tag(testId: string, feature: string, severity: string): void {
  test.info().annotations.push(
    { type: 'testId',   description: testId  },
    { type: 'epic',     description: 'Carts' },
    { type: 'feature',  description: feature },
    { type: 'severity', description: severity },
    { type: 'tag',      description: 'api'   },
    { type: 'tag',      description: 'carts' },
  );
}

// ── Shared cart validator ─────────────────────────────────────────────────────

function assertCartContract(cart: Cart): void {
  validateSchema<Cart>(cart, cartSchema);
  expect(cart.id,     'id must be > 0').toBeGreaterThanOrEqual(CartConstraints.VALID_USER_ID_MIN);
  expect(cart.userId, 'userId must be > 0').toBeGreaterThanOrEqual(CartConstraints.VALID_USER_ID_MIN);
  expect(cart.date,   'date must match YYYY-MM-DD format').toMatch(DATE_REGEX);
  expect(cart.products.length, 'cart must have at least 1 product')
    .toBeGreaterThanOrEqual(CartConstraints.MIN_PRODUCT_COUNT);
  cart.products.forEach((p, i) => {
    expect(p.productId, `product[${i}].productId must be > 0`).toBeGreaterThan(0);
    expect(p.quantity,  `product[${i}].quantity must be ≥ ${CartConstraints.MIN_QUANTITY}`)
      .toBeGreaterThanOrEqual(CartConstraints.MIN_QUANTITY);
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Carts API', () => {

  // TC-CART-001 ────────────────────────────────────────────────────────────────
  test('TC-CART-001 | GET /carts returns full list with valid schema per cart', async ({
    cartsClient,
  }) => {
    tag('TC-CART-001', 'GET /carts', 'high');

    const carts = await cartsClient.getAll();

    expect(carts.length, 'must return at least 1 cart').toBeGreaterThan(0);
    expect(carts.length, `total carts must be ${cartsData.totalCartCount}`)
      .toBe(cartsData.totalCartCount);

    carts.forEach(c => assertCartContract(c));

    expect(cartsClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.NORMAL);
  });

  // TC-CART-002 — data-driven across valid cart IDs ───────────────────────────
  for (const id of cartsData.validIds) {
    test(`TC-CART-002 | GET /carts/${id} returns correct cart`, async ({ cartsClient }) => {
      tag('TC-CART-002', `GET /carts/:id (id=${id})`, 'high');

      const cart = await cartsClient.getById(id);

      assertCartContract(cart);
      expect(cart.id, `cart.id must equal requested ${id}`).toBe(id);

      expect(cartsClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.FAST);
    });
  }

  // TC-CART-003 ────────────────────────────────────────────────────────────────
  test('TC-CART-003 | GET /carts?limit=N returns exactly N carts', async ({ cartsClient }) => {
    tag('TC-CART-003', 'GET /carts — pagination', 'medium');

    for (const limit of [1, 3, 5]) {
      const carts = await cartsClient.getAll(limit);
      expect(carts, `limit=${limit} must return exactly ${limit} carts`).toHaveLength(limit);
      carts.forEach(c => validateSchema<Cart>(c, cartSchema));
    }
  });

  // TC-CART-004 ────────────────────────────────────────────────────────────────
  test('TC-CART-004 | GET /carts?startdate&enddate filters by date range', async ({
    cartsClient,
  }) => {
    tag('TC-CART-004', 'GET /carts — date filter', 'medium');

    const carts = await cartsClient.getByDateRange('2020-01-01', '2020-12-31');

    expect(Array.isArray(carts), 'response must be an array').toBe(true);
    carts.forEach(c => {
      validateSchema<Cart>(c, cartSchema);
      const cartDate = new Date(c.date).getFullYear();
      expect(cartDate, 'cart date must be within 2020').toBe(2020);
    });
  });

  // TC-CART-005 ────────────────────────────────────────────────────────────────
  test('TC-CART-005 | POST /carts creates cart with products array', async ({ cartsClient }) => {
    tag('TC-CART-005', 'POST /carts', 'high');

    const payload = cartsData.create;
    const created = await cartsClient.create(payload);

    validateSchema<Cart>(created, cartSchema);
    expect(typeof created.id, 'id must be a number').toBe('number');
    expect(created.id, 'id must be > 0').toBeGreaterThan(0);
    expect(created.products.length, 'products must be present').toBeGreaterThan(0);
    expect(
      created.products.every(p => p.quantity >= CartConstraints.MIN_QUANTITY),
      'all quantities must be ≥ 1',
    ).toBe(true);

    expect(cartsClient.lastResponseTimeMs).toBeLessThan(ResponseTimeLimit.NORMAL);
  });

  // TC-CART-006 ────────────────────────────────────────────────────────────────
  test('TC-CART-006 | PUT /carts/:id fully replaces the cart', async ({ cartsClient }) => {
    tag('TC-CART-006', 'PUT /carts/:id', 'medium');

    const payload = cartsData.update.full;
    const updated = await cartsClient.update(1, payload);

    validateSchema<Cart>(updated, cartSchema);
    expect(updated.userId, 'PUT: userId must reflect update').toBe(payload.userId);
    expect(updated.date,   'PUT: date must reflect update').toBe(payload.date);
    expect(updated.products.length, 'PUT: products must reflect update').toBe(payload.products.length);
  });

  // TC-CART-007 ────────────────────────────────────────────────────────────────
  test('TC-CART-007 | PATCH /carts/:id partially updates the products', async ({ cartsClient }) => {
    tag('TC-CART-007', 'PATCH /carts/:id', 'medium');

    const original = await cartsClient.getById(1);
    const patch    = cartsData.update.partial;

    const updated = await cartsClient.partialUpdate(1, patch);

    validateSchema<Cart>(updated, cartSchema);
    expect(updated.products.length, 'PATCH: products must be updated').toBe(patch.products.length);
    expect(updated.userId, 'PATCH: userId must be unchanged').toBe(original.userId);
  });

  // TC-CART-008 ────────────────────────────────────────────────────────────────
  test('TC-CART-008 | DELETE /carts/:id returns the deleted cart', async ({ cartsClient }) => {
    tag('TC-CART-008', 'DELETE /carts/:id', 'medium');

    const deleted = await cartsClient.remove(1);

    expect(deleted, 'deleted resource must be returned').toBeDefined();
    expect(deleted.id, 'returned id must match').toBe(1);
    validateSchema<Cart>(deleted, cartSchema);
  });
});
