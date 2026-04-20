import { test as base } from '@playwright/test';
import { AuthApiClient }     from '../../aut/api/clients/AuthApiClient';
import { ProductsApiClient } from '../../aut/api/clients/ProductsApiClient';
import { UsersApiClient }    from '../../aut/api/clients/UsersApiClient';
import { CartsApiClient }    from '../../aut/api/clients/CartsApiClient';

export type ApiFixtures = {
  authClient:     AuthApiClient;
  productsClient: ProductsApiClient;
  usersClient:    UsersApiClient;
  cartsClient:    CartsApiClient;
};

export const test = base.extend<ApiFixtures>({
  authClient:     async ({ request }, use) => { await use(new AuthApiClient(request)); },
  productsClient: async ({ request }, use) => { await use(new ProductsApiClient(request)); },
  usersClient:    async ({ request }, use) => { await use(new UsersApiClient(request)); },
  cartsClient:    async ({ request }, use) => { await use(new CartsApiClient(request)); },
});
