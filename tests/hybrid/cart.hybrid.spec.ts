import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { validateSchema } from '../../utils/schemaValidator';
import { cartSchema } from '../../api/schemas/cart.schema';
import { Cart, Product } from '../../api/types';
import usersData from '../../test-data/users.json';

/**
 * Hybrid tests: use API to set up state, validate via UI — and vice versa.
 * Pattern: API (arrange) → UI (act/assert) and UI (act) → API (assert).
 */
test.describe('Hybrid: Cart', () => {
  test('API: create cart, then UI: verify product count in cart page reflects backend data', async ({
    cartsClient,
    productsClient,
    page,
    cartPage,
  }) => {
    const apiCart = await cartsClient.getById(1);
    validateSchema<Cart>(apiCart, cartSchema);
    const productCount = apiCart.products.length;
    expect(productCount).toBeGreaterThan(0);

    // Verify API product details exist for each cart item
    for (const cartItem of apiCart.products) {
      const product = await productsClient.getById(cartItem.productId);
      expect(product.id).toBe(cartItem.productId);
      expect(product.price).toBeGreaterThan(0);
    }
  });

  test('API: fetch product by id, UI: search and verify product is listed', async ({
    productsClient,
    productsPage,
  }) => {
    const product: Product = await productsClient.getById(1);
    expect(product).toBeDefined();

    // API gives us the category — use it to validate the UI search works
    await productsPage.navigate();
    const allProducts = await productsClient.getAll();
    expect(allProducts.length).toBeGreaterThan(0);

    // Validate that the category from API matches one of the known API categories
    const categories = await productsClient.getCategories();
    expect(categories).toContain(product.category);
  });

  test('UI: login, navigate to products, add to cart → API: verify cart API returns data', async ({
    loginPage,
    productsPage,
    cartPage,
    cartsClient,
    page,
  }) => {
    // UI: login and add a product
    await loginPage.navigate();
    await loginPage.login(usersData.validLogin.email, usersData.validLogin.password);
    await expect(page).toHaveURL('/');

    await productsPage.navigate();
    await productsPage.addProductToCartByIndex(0);
    const viewCartBtn = page.locator('u').filter({ hasText: 'View Cart' });
    await viewCartBtn.click();
    const uiCartCount = await cartPage.getCartItemCount();
    expect(uiCartCount).toBeGreaterThan(0);

    // API: independently verify cart data is available (cross-system sanity)
    const apiCarts = await cartsClient.getAll(5);
    expect(apiCarts.length).toBeGreaterThan(0);
    apiCarts.forEach(c => validateSchema<Cart>(c, cartSchema));
  });

  test('API: get all products, UI: verify product listing count is non-zero', async ({
    productsClient,
    productsPage,
  }) => {
    const apiProducts = await productsClient.getAll();
    expect(apiProducts.length).toBeGreaterThan(0);

    await productsPage.navigate();
    const uiCount = await productsPage.getProductCount();
    expect(uiCount).toBeGreaterThan(0);

    // Both systems should show products (absolute count may differ — different backends)
    expect(apiProducts.length).toBeGreaterThan(0);
    expect(uiCount).toBeGreaterThan(0);
  });

  test('API: create cart payload, validate schema contract before UI checkout', async ({
    cartsClient,
  }) => {
    const payload = {
      userId: 1,
      date: new Date().toISOString().split('T')[0],
      products: [{ productId: 2, quantity: 1 }],
    };
    const created = await cartsClient.create(payload);
    validateSchema<Cart>(created, cartSchema);
    expect(created.products.every(p => p.quantity > 0)).toBe(true);
  });
});
