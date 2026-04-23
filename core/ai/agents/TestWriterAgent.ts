import * as fs                             from 'fs/promises';
import * as path                           from 'path';
import { AgentFn, emitStage }             from './AgentGraph';
import { PlannerState }                   from './TestPlannerAgent';
import { logger }                          from '../../utils/logger';

export interface WriterState extends PlannerState {
  code?:      string;
  filename?:  string;
  testCount?: number;
  outputPath?: string;
}

const SYSTEM_PROMPT = `
You are a senior SDET writing production-grade Playwright TypeScript spec files.
You receive a structured test plan and produce a complete, compilable spec.

════════════════════════════════════════════════════════════
  MANDATORY IMPORT CONVENTIONS
════════════════════════════════════════════════════════════

For specs in aut/tests/ai/ or aut/tests/ai/generated/:
  import { test }   from '../../../core/fixtures';
  import { expect } from '@playwright/test';

For specs in aut/tests/ui/auth/ or any aut/tests/ui/*/:
  import { test }   from '../../../../core/fixtures';
  import { expect } from '@playwright/test';

For specs in aut/tests/api/ or aut/tests/hybrid/:
  import { test }   from '../../../core/fixtures';
  import { expect } from '@playwright/test';

════════════════════════════════════════════════════════════
  AVAILABLE FIXTURES (inject by name in test function)
════════════════════════════════════════════════════════════

PAGE FIXTURES:
  loginPage, homePage, productsPage, productDetailPage, cartPage, checkoutPage

API FIXTURES:
  authClient, productsClient, usersClient, cartsClient

AI FIXTURES:
  testData, aiPage, visualTester

════════════════════════════════════════════════════════════
  PAGE OBJECT METHODS
════════════════════════════════════════════════════════════

loginPage:
  navigate() | login(email, pwd) | initiateSignup(name, email)
  assertLoginError(text) | assertSignupError(text)

productsPage:
  navigate() | searchProduct(term) | getProductCount()
  addProductToCartByIndex(index)

cartPage:
  navigate() | getItemCount() | proceedToCheckout()

checkoutPage:
  navigate() | placeOrder(comment?)

════════════════════════════════════════════════════════════
  STRICT OUTPUT RULES
════════════════════════════════════════════════════════════

1. Output ONLY a TypeScript code block wrapped in \`\`\`typescript ... \`\`\`
2. Every test is async with destructured fixtures
3. Use test.describe() to group all tests
4. Add test.beforeEach() for repeated setup
5. All navigation via POM navigate() — never raw page.goto()
6. Use data-qa selectors: page.locator('[data-qa="..."]') for unmapped elements
7. Meaningful test names describing user intent, not implementation
8. At least one expect() per test
`;

export const testWriterAgent: AgentFn<WriterState> = async (state, ai): Promise<WriterState> => {
  if (!state.plan) {
    return { ...state, error: '[TestWriterAgent] No plan provided — planner must run first' };
  }

  logger.info(`[TestWriterAgent] Writing spec for "${state.plan.testSuite}"`);
  emitStage(state.sessionId, 'writing', state.inputType, JSON.stringify(state.plan, null, 2));

  const raw = await ai.complete({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:
      `Write a complete Playwright TypeScript spec for this test plan:\n\n` +
      `${JSON.stringify(state.plan, null, 2)}\n\n` +
      `Target location: aut/tests/ai/generated/\n` +
      `Use import path: '../../../core/fixtures'\n` +
      `Return ONLY the TypeScript code block.`,
    maxTokens: 8000,
    operation: 'write',
  });

  const code = extractCodeBlock(raw);
  const testCount = (code.match(/\btest\(/g) ?? []).length;
  const filename = state.outputPath ?? deriveFilename(state.plan.testSuite);

  if (state.outputPath) {
    await fs.mkdir(path.dirname(path.resolve(state.outputPath)), { recursive: true });
    await fs.writeFile(path.resolve(state.outputPath), code, 'utf8');
    logger.info(`[TestWriterAgent] Spec written → ${state.outputPath}`);
  }

  emitStage(state.sessionId, 'writing', state.inputType, code);
  return { ...state, code, filename, testCount };
};

function extractCodeBlock(raw: string): string {
  const match = raw.match(/```(?:typescript|ts)?\s*([\s\S]+?)```/);
  return match ? match[1].trim() : raw.trim();
}

function deriveFilename(suiteName: string): string {
  const slug = suiteName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `aut/tests/ai/generated/${slug}.spec.ts`;
}
