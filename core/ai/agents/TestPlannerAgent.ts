import { AgentFn, AgentState, emitStage } from './AgentGraph';
import { TestPlanSchema, TestPlan }       from '../schema';
import { AIClient }                       from '../AIClient';
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
produce a comprehensive, structured JSON test plan.

Rules:
- Each test case must have at minimum 3 steps
- Every test that modifies state must assert the resulting state
- Include both happy-path and at least one negative/boundary test per suite
- Use "pom" field to map to existing POM methods where applicable:
    loginPage.navigate() | loginPage.fillEmail(email) | loginPage.fillPassword(pwd)
    loginPage.clickLoginButton() | loginPage.assertLoginError(msg)
    productsPage.navigate() | productsPage.searchProduct(term) | productsPage.getProductCount()
    cartPage.navigate() | cartPage.getItemCount() | cartPage.proceedToCheckout()
- Priority: critical for smoke/auth, high for main flows, medium for edge cases
- Return ONLY the JSON — no markdown, no prose.
`;

export const testPlannerAgent: AgentFn<PlannerState> = async (state, ai): Promise<PlannerState> => {
  logger.info(`[TestPlannerAgent] Planning (${state.inputType})`);
  emitStage(state.sessionId, 'planning', state.inputType, state.input);

  const plan = await ai.completeJson<TestPlan>(
    {
      systemPrompt: SYSTEM_PROMPT,
      userMessage:
        `Input type: ${state.inputType}\n\n` +
        `${state.input}\n\n` +
        `Generate a complete test plan as a JSON object matching exactly:\n` +
        `{ "testSuite": string, "description": string, "tests": TestCase[], "fixtures": string[] }`,
      maxTokens: 4096,
      operation: 'plan',
    },
    TestPlanSchema,
  );

  logger.info(`[TestPlannerAgent] Plan: ${plan.tests.length} test(s) in "${plan.testSuite}"`);
  return { ...state, plan };
};
