Playwright_TS_AI/
├── playwright.config.ts         ← 4 projects: ui | ui-firefox | api | hybrid
├── package.json / tsconfig.json
├── .env / .env.example
│
├── utils/                       ← Foundation layer
│   ├── envConfig.ts             ← Type-safe env with fail-fast validation
│   ├── logger.ts                ← Winston (console + file transport)
│   ├── helpers.ts               ← randomEmail, randomString, waitForCondition
│   └── schemaValidator.ts       ← AJV with compiled schema cache
│
├── api/                         ← API layer
│   ├── clients/
│   │   ├── BaseApiClient.ts     ← HTTP methods, auth injection, error handling
│   │   ├── AuthApiClient.ts
│   │   ├── ProductsApiClient.ts
│   │   ├── UsersApiClient.ts
│   │   └── CartsApiClient.ts
│   ├── types/                   ← TypeScript interfaces per resource
│   └── schemas/                 ← AJV JSON schemas (product, user, cart)
│
├── pages/                       ← POM layer
│   ├── BasePage.ts              ← navigate, assertVisible, assertUrl, helpers
│   ├── HomePage/LoginPage/SignupPage
│   ├── ProductsPage/ProductDetailPage
│   └── CartPage/CheckoutPage
│
├── fixtures/
│   ├── pageFixtures.ts          ← test.extend with all page objects
│   ├── apiFixtures.ts           ← test.extend with all API clients
│   └── index.ts                 ← mergeTests() — hybrid tests get both
│
├── test-data/                   ← users.json, products.json, carts.json
│
├── tests/
│   ├── ui/auth/                 ← login.spec, signup.spec
│   ├── ui/products/             ← productListing.spec, productSearch.spec
│   ├── ui/cart/                 ← cart.spec (guest + auth + checkout)
│   ├── api/                     ← products/users/carts/auth.api.spec
│   └── hybrid/                  ← cart.hybrid.spec (API arrange → UI assert)
│
├── .github/workflows/ci.yml     ← Parallel jobs: api ∥ ui → hybrid → allure → Pages
├── Dockerfile
└── docker-compose.yml           ← Services: playwright | api | ui | hybrid | allure
