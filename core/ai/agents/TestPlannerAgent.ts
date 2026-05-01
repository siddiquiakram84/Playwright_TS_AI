import { AgentFn, AgentState, emitStage } from './AgentGraph';
import { TestPlanSchema, TestPlan }       from '../schema';
import { AIClient }                       from '../AIClient';
import { ragRetriever, ensureIndexLoaded } from '../memory';
import { logger }                         from '../../utils/logger';

export interface PlannerInput {
  /** Raw source: user story, NL instruction, or JSON-serialised recorded actions */
  input:      string;
  inputType:  'story' | 'nl' | 'recording';
}

export interface PlannerState extends AgentState, PlannerInput {
  plan?: TestPlan;
}

const SYSTEM_PROMPT = `
You are a principal SDET designing Playwright test plans for an e-commerce application.

Application under test: https://automationexercise.com
  • /login      — Login (left form) + Signup (right form)
  • /products   — Product listing with search
  • /product_details/:id  — Detail page
  • /view_cart  — Cart management
  • /checkout   — Checkout flow

Given a user story, natural language instruction, or list of recorded browser actions,
produce a structured JSON test plan.

REQUIRED JSON SHAPE (use these exact field names — no substitutes):
{
  "testSuite": "Suite name",
  "description": "What this suite covers",
  "fixtures": ["auth", "page"],
  "tests": [
    {
      "name": "Test case title",
      "priority": "critical" | "high" | "medium" | "low",
      "tags": ["smoke"],
      "dataNeeds": ["validUser"],
      "steps": [
        { "action": "navigate", "target": "/login", "description": "Open login page" },
        { "action": "fill",     "target": "#email", "value": "user@test.com", "pom": "loginPage.fillEmail(email)" },
        { "action": "click",    "target": "button[type=submit]", "pom": "loginPage.clickLoginButton()" },
        { "action": "assert",   "target": ".logged-in-as", "assertType": "visible", "expected": "Logged in as" }
      ]
    }
  ]
}

FIELD RULES:
- "action" MUST be one of: navigate | fill | click | assert | wait | select | hover | check | screenshot
- "target" MUST be a CSS selector, URL path, or descriptive element name — never null or empty
- "name" is the test title — always a string, never null
- Each test: 3–8 steps, at least one "assert" step
- Include happy-path and one negative/boundary test per suite
- Use "pom" field to reference existing POM methods where applicable:
    loginPage.navigate() | loginPage.fillEmail(email) | loginPage.fillPassword(pwd)
    loginPage.clickLoginButton() | loginPage.assertLoginError(msg)
    productsPage.navigate() | productsPage.searchProduct(term) | productsPage.getProductCount()
    cartPage.navigate() | cartPage.getItemCount() | cartPage.proceedToCheckout()
- Generate ONLY the test cases the provided story/instruction directly requires:
    • Single user story  → 1 happy-path + 1 negative/boundary (2 tests total)
    • Multi-flow feature → 1 test per distinct flow, hard cap 4
    • DO NOT pad — 2 precise tests beat 6 redundant ones
- Return ONLY the JSON object — no markdown fences, no prose, no trailing commas.
`;

export const testPlannerAgent: AgentFn<PlannerState> = async (state, ai): Promise<PlannerState> => {
  logger.info(`[TestPlannerAgent] Planning (${state.inputType})`);
  emitStage(state.sessionId, 'planning', state.inputType, state.input);

  // RAG: inject relevant existing specs/POMs as context so the LLM mirrors
  // the codebase's patterns instead of generating inconsistent code.
  await ensureIndexLoaded();
  const ragContext = await ragRetriever.getContextBlock(state.input, 6);
  if (ragContext) logger.info('[TestPlannerAgent] RAG: injected codebase context');

  const plan = await ai.completeJson<TestPlan>(
    {
      systemPrompt: SYSTEM_PROMPT + ragContext,
      userMessage:
        `Input type: ${state.inputType}\n\n` +
        `${state.input}\n\n` +
        `Generate the test plan JSON. Use the exact field names from the system prompt.`,
      maxTokens: 8192,
      operation: 'plan',
    },
    TestPlanSchema,
  );

  logger.info(`[TestPlannerAgent] Plan: ${plan.tests.length} test(s) in "${plan.testSuite}"`);
  return { ...state, plan };
};
