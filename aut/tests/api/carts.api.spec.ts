import { expect } from '@playwright/test';
import { test } from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { cartSchema } from '../../api/schemas/cart.schema';
import { Cart } from '../../api/types';
import cartsData from '../../test-data/carts.json';

test.describe('Carts API', () => {
  test('GET /carts - should return array of carts', async ({ cartsClient }) => {
    const carts = await cartsClient.getAll();
    expect(carts.length).toBeGreaterThan(0);
    carts.forEach(c => validateSchema<Cart>(c, cartSchema));
  });

  test('GET /carts?limit=3 - should respect limit', async ({ cartsClient }) => {
    const carts = await cartsClient.getAll(3);
    expect(carts).toHaveLength(3);
  });

  test('GET /carts/:id - should return cart with valid schema', async ({ cartsClient }) => {
    const cart = await cartsClient.getById(1);
    validateSchema<Cart>(cart, cartSchema);
    expect(cart.id).toBe(1);
    expect(Array.isArray(cart.products)).toBe(true);
  });

  test('GET /carts/user/:userId - should return carts for user', async ({ cartsClient }) => {
    const carts = await cartsClient.getByUser(1);
    expect(Array.isArray(carts)).toBe(true);
    carts.forEach(c => expect(c.userId).toBe(1));
  });

  test('POST /carts - should create a new cart', async ({ cartsClient }) => {
    const payload = cartsData.createCart;
    const created = await cartsClient.create(payload);
    validateSchema<Cart>(created, cartSchema);
    expect(created.userId).toBe(payload.userId);
    expect(created.products).toHaveLength(payload.products.length);
  });

  test('PUT /carts/:id - should fully update a cart', async ({ cartsClient }) => {
    const payload = cartsData.updateCart;
    const updated = await cartsClient.update(1, payload);
    validateSchema<Cart>(updated, cartSchema);
    expect(updated.userId).toBe(payload.userId);
  });

  test('PATCH /carts/:id - should partially update a cart', async ({ cartsClient }) => {
    const patched = await cartsClient.partialUpdate(1, {
      products: [{ productId: 2, quantity: 5 }],
    });
    expect(patched).toBeDefined();
  });

  test('DELETE /carts/:id - should delete a cart', async ({ cartsClient }) => {
    const deleted = await cartsClient.remove(1);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(1);
  });

  test('GET /carts - all cart products should have positive quantities', async ({
    cartsClient,
  }) => {
    const carts = await cartsClient.getAll();
    carts.forEach(cart => {
      cart.products.forEach(p => {
        expect(p.quantity).toBeGreaterThan(0);
        expect(p.productId).toBeGreaterThan(0);
      });
    });
  });
});
