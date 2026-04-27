import * as fs                             from 'fs/promises';
import * as path                           from 'path';
import { AgentFn, emitStage }             from './AgentGraph';
import { PlannerState }                   from './TestPlannerAgent';
import { logger }                          from '../../utils/logger';

export interface WriterState extends PlannerState {
  code?:        string;
  dataJson?:    string;   // companion test-data JSON file content
  filename?:    string;
  dataFilename?: string;
  testCount?:   number;
  outputPath?:  string;
}

const SYSTEM_PROMPT = `
You are a senior SDET writing production-grade Playwright TypeScript spec files.
You receive a structured test plan and produce TWO outputs:

1. A complete, compilable Playwright spec file that mirrors a real user journey
2. A companion test-data JSON file with all non-sensitive test inputs

════════════════════════════════════════════════════════════
  IMPORT CONVENTIONS
════════════════════════════════════════════════════════════

For specs in aut/tests/ai/generated/:
  import { test }   from '../../../core/fixtures';
  import { expect } from '@playwright/test';
  import testData   from './[slug].data.json';

════════════════════════════════════════════════════════════
  PAGE OBJECT API — EXACT METHOD SIGNATURES
════════════════════════════════════════════════════════════

homePage (url: '/')
  isLoggedIn(): Promise<boolean>
  getLoggedInUsername(): Promise<string>
  goToLogin(): Promise<void>
  goToProducts(): Promise<void>
  goToCart(): Promise<void>
  logout(): Promise<void>
  Locators: navLogin, navLogout, navCart, navProducts, loggedInUser, featuredItems

loginPage (url: '/login')
  login(email: string, password: string): Promise<void>
  initiateSignup(name: string, email: string): Promise<void>
  assertLoginError(expectedText: string): Promise<void>
  assertSignupError(expectedText: string): Promise<void>
  Locators: loginEmailInput, loginPasswordInput, loginBtn, loginErrorMsg
            signupNameInput, signupEmailInput, signupBtn

productsPage (url: '/products')
  searchProduct(keyword: string): Promise<void>
  getProductCount(): Promise<number>
  getProductNames(): Promise<string[]>
  clickViewProduct(index?: number): Promise<void>
  addProductToCartByIndex(index?: number): Promise<void>
  assertSearchResultsVisible(): Promise<void>
  assertAllResultsContain(keyword: string): Promise<void>
  Locators: searchInput, searchBtn, productCards, allProductsHeading

productDetailPage (url: '/product_details')
  setQuantity(quantity: number): Promise<void>
  addToCart(): Promise<void>
  getProductName(): Promise<string>
  getProductPrice(): Promise<string>
  assertProductDetails(name: string, category: string): Promise<void>
  Locators: productName, productPrice, productBrand, quantityInput, addToCartBtn

cartPage (url: '/view_cart')
  getCartItemCount(): Promise<number>
  getCartItems(): Promise<CartItem[]>    // {name, qty, price, total}
  removeItem(index?: number): Promise<void>
  proceedToCheckout(): Promise<void>
  handleAuthModal(action: 'continue' | 'checkout'): Promise<void>
  assertCartHasItems(expectedCount: number): Promise<void>
  assertCartIsEmpty(): Promise<void>
  Locators: cartRows, proceedToCheckoutBtn, emptyCartMessage

checkoutPage (url: '/checkout')
  addComment(text: string): Promise<void>
  placeOrder(): Promise<void>
  fillPaymentDetails(cardName, cardNum, cvc, month, year): Promise<void>
  confirmPayment(): Promise<void>
  assertOrderPlaced(): Promise<void>
  assertDeliveryAddress(containsText: string): Promise<void>
  Locators: commentTextarea, placeOrderBtn, payConfirmBtn, orderSuccessHeading

════════════════════════════════════════════════════════════
  AI FIXTURES
════════════════════════════════════════════════════════════

aiPage — SelfHealingPage wrapping the Playwright page.
  aiPage.locator(selector) → SelfHealingLocator  (auto-heals on DOM change)
    Methods: fill(text) | click() | type(text) | isVisible() | getAttribute(name) | raw()
  Use aiPage.locator() ONLY for selectors NOT covered by the POM (dynamic content,
  third-party widgets, or elements likely to change). Prefer POM methods for known pages.

visualTester — VisualAITester
  compare(name, options?) → { passed, differences, summary }

testData — TestDataFactory
  generateUser() | generateProduct() | generateSearchTerms()

════════════════════════════════════════════════════════════
  ENV (import from core/utils/envConfig)
════════════════════════════════════════════════════════════

ENV.uiUserEmail | ENV.uiUserPassword | ENV.baseUrl

════════════════════════════════════════════════════════════
  TEST DATA JSON FORMAT
════════════════════════════════════════════════════════════

{
  "scenarios": [
    { "id": "TC-XXX-001", "description": "...", "testData": { "fieldName": "value" } }
  ],
  "constants": {
    "expectedMessages": { "key": "value" },
    "routes": { "loginUrl": "/login" }
  }
}

NEVER put passwords, API keys, or tokens in JSON — use ENV.* in the spec.

════════════════════════════════════════════════════════════
  STRICT OUTPUT FORMAT
════════════════════════════════════════════════════════════

Return EXACTLY two fenced code blocks — nothing else:

\`\`\`typescript
// spec file content
\`\`\`

\`\`\`json
// test-data JSON content
\`\`\`

════════════════════════════════════════════════════════════
  SPEC CODING RULES — REAL USER JOURNEY STANDARD
════════════════════════════════════════════════════════════

1.  JOURNEY STRUCTURE: Each test.describe represents one real user journey end-to-end.
    Multi-step flows (login → add to cart → checkout) MUST use serial mode:
      test.describe.configure({ mode: 'serial' });

2.  NAVIGATION: Always use POM .navigate() — never raw page.goto().
    For the login precondition in beforeEach:
      await loginPage.navigate();
      await loginPage.login(ENV.uiUserEmail, ENV.uiUserPassword);
      await homePage.navigate();   // land on home after login

3.  CREDENTIALS: Only from ENV.uiUserEmail / ENV.uiUserPassword — never hardcoded.

4.  ASSERTIONS: Assert state after EVERY mutation:
    - After login: await expect(homePage.loggedInUser).toBeVisible()
    - After add to cart: const count = await cartPage.getCartItemCount(); expect(count).toBeGreaterThan(0)
    - After checkout: await checkoutPage.assertOrderPlaced()

5.  ALLURE ANNOTATIONS:
      test.info().annotations.push({ type: 'feature', value: 'Cart' });
      test.info().annotations.push({ type: 'severity', value: 'critical' });

6.  UNMAPPED SELECTORS: Use data-qa attributes when not covered by POM:
      page.locator('[data-qa="login-button"]')
    For selectors that may be fragile (3rd-party, dynamic), use aiPage.locator():
      await aiPage.locator('.dynamic-widget').click()

7.  MODULAR DESIGN: One describe per feature area. Shared setup in beforeEach.
    Do NOT mix unrelated features in a single describe block.

8.  MINIMUM QUALITY: 2 expect() calls per test. Meaningful names describing user intent.

9.  SOFT ASSERTIONS: Use expect.soft() for non-critical checks so one failure
    doesn't skip remaining assertions in the same test.

10. CLEANUP: Tear down shared state (logout) in afterAll for serial suites.
`;

export const testWriterAgent: AgentFn<WriterState> = async (state, ai): Promise<WriterState> => {
  if (!state.plan) {
    return { ...state, error: '[TestWriterAgent] No plan provided — planner must run first' };
  }

  logger.info(`[TestWriterAgent] Writing spec for "${state.plan.testSuite}"`);
  emitStage(state.sessionId, 'writing', state.inputType, JSON.stringify(state.plan, null, 2));

  const slug     = deriveSlug(state.plan.testSuite);
  const specPath = state.outputPath ?? `aut/tests/ai/generated/${slug}.spec.ts`;
  const dataPath = specPath.replace(/\.spec\.ts$/, '.data.json');

  const raw = await ai.complete({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:
      `Write a complete Playwright spec + test-data JSON for this plan:\n\n` +
      `${JSON.stringify(state.plan, null, 2)}\n\n` +
      `Spec file: ${specPath}\n` +
      `Data file: ${dataPath}\n\n` +
      `Return exactly two fenced code blocks: typescript then json.`,
    maxTokens: 10_000,
    operation: 'write',
  });

  const { spec: code, data: dataJson } = extractBlocks(raw);
  const testCount = (code.match(/\btest\(/g) ?? []).length;

  if (state.outputPath) {
    await fs.mkdir(path.dirname(path.resolve(specPath)), { recursive: true });
    await fs.writeFile(path.resolve(specPath), code, 'utf8');
    logger.info(`[TestWriterAgent] Spec  → ${specPath}`);

    if (dataJson) {
      await fs.writeFile(path.resolve(dataPath), dataJson, 'utf8');
      logger.info(`[TestWriterAgent] Data  → ${dataPath}`);
    }
  }

  emitStage(state.sessionId, 'writing', state.inputType, code);
  return {
    ...state,
    code,
    dataJson,
    filename:     specPath,
    dataFilename: dataPath,
    testCount,
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBlocks(raw: string): { spec: string; data: string } {
  const tsMatch   = raw.match(/```(?:typescript|ts)\s*([\s\S]+?)```/);
  const jsonMatch = raw.match(/```json\s*([\s\S]+?)```/);
  return {
    spec: tsMatch   ? tsMatch[1].trim()   : raw.trim(),
    data: jsonMatch ? jsonMatch[1].trim() : '',
  };
}

function deriveSlug(suiteName: string): string {
  return suiteName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}
