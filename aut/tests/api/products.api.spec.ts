import { expect } from '@playwright/test';
import { test } from '../../../core/fixtures';
import { validateSchema } from '../../../core/utils/schemaValidator';
import { productSchema, productsArraySchema } from '../../api/schemas/product.schema';
import { Product } from '../../api/types';
import productsData from '../../test-data/products.json';

test.describe('Products API', () => {
  test('GET /products - should return array of products with valid schema', async ({
    productsClient,
  }) => {
    const products = await productsClient.getAll();
    expect(products.length).toBeGreaterThan(0);
    validateSchema<Product[]>(products, productsArraySchema);
  });

  test('GET /products/:id - should return a single product', async ({ productsClient }) => {
    for (const id of productsData.validProductIds) {
      const product = await productsClient.getById(id);
      validateSchema<Product>(product, productSchema);
      expect(product.id).toBe(id);
    }
  });

  test('POST /products - should create a product and return with id', async ({
    productsClient,
  }) => {
    const payload = productsData.apiProduct.create;
    const created = await productsClient.create(payload);
    validateSchema<Product>(created, productSchema);
    expect(created.title).toBe(payload.title);
    expect(created.price).toBe(payload.price);
    expect(typeof created.id).toBe('number');
  });

  test('DELETE /products/:id - should delete a product', async ({ productsClient }) => {
    const deleted = await productsClient.remove(1);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(1);
  });

});
