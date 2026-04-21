import { expect } from '@playwright/test';
import { test } from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { cartSchema } from '../../api/schemas/cart.schema';
import { Cart } from '../../api/types';

test.describe('Carts API', () => {
  test('GET /carts - should return array of carts', async ({ cartsClient }) => {
    const carts = await cartsClient.getAll();
    expect(carts.length).toBeGreaterThan(0);
    carts.forEach(c => validateSchema<Cart>(c, cartSchema));
  });

});
