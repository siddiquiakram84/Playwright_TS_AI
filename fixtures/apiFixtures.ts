import { test as base } from '@playwright/test';
import { AuthApiClient } from '../api/clients/AuthApiClient';
import { ProductsApiClient } from '../api/clients/ProductsApiClient';
import { UsersApiClient } from '../api/clients/UsersApiClient';
import { CartsApiClient } from '../api/clients/CartsApiClient';

export type ApiFixtures = {
  authClient: AuthApiClient;
  productsClient: ProductsApiClient;
  usersClient: UsersApiClient;
  cartsClient: CartsApiClient;
};

export const test = base.extend<ApiFixtures>({
  authClient: async ({ request }, use) => {
    await use(new AuthApiClient(request));
  },
  productsClient: async ({ request }, use) => {
    await use(new ProductsApiClient(request));
  },
  usersClient: async ({ request }, use) => {
    await use(new UsersApiClient(request));
  },
  cartsClient: async ({ request }, use) => {
    await use(new CartsApiClient(request));
  },
});
