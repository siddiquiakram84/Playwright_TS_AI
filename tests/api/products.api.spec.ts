import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { validateSchema } from '../../utils/schemaValidator';
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

  test('GET /products?limit=5 - should respect limit parameter', async ({ productsClient }) => {
    const products = await productsClient.getAll(5);
    expect(products).toHaveLength(5);
  });

  test('GET /products/:id - should return a single product', async ({ productsClient }) => {
    for (const id of productsData.validProductIds) {
      const product = await productsClient.getById(id);
      validateSchema<Product>(product, productSchema);
      expect(product.id).toBe(id);
    }
  });

  test('GET /products/categories - should return categories array', async ({ productsClient }) => {
    const categories = await productsClient.getCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    productsData.categories.api.forEach(cat => {
      expect(categories).toContain(cat);
    });
  });

  test('GET /products/category/:name - should filter by category', async ({ productsClient }) => {
    const category = 'electronics';
    const products = await productsClient.getByCategory(category);
    expect(products.length).toBeGreaterThan(0);
    products.forEach(p => expect(p.category).toBe(category));
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

  test('PUT /products/:id - should update a product fully', async ({ productsClient }) => {
    const payload = productsData.apiProduct.create;
    const updated = await productsClient.update(1, payload);
    validateSchema<Product>(updated, productSchema);
    expect(updated.title).toBe(payload.title);
  });

  test('PATCH /products/:id - should partially update a product', async ({ productsClient }) => {
    const { update } = productsData.apiProduct;
    const patched = await productsClient.partialUpdate(1, update);
    expect(patched.title).toBe(update.title);
    expect(patched.price).toBe(update.price);
  });

  test('DELETE /products/:id - should delete a product', async ({ productsClient }) => {
    const deleted = await productsClient.remove(1);
    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(1);
  });

  test('GET /products/:id - all products should have valid prices', async ({ productsClient }) => {
    const products = await productsClient.getAll();
    products.forEach(p => {
      expect(p.price).toBeGreaterThan(0);
      expect(typeof p.price).toBe('number');
    });
  });
});
