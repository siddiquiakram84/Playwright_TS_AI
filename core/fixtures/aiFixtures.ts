import { test as base } from '@playwright/test';
import { SelfHealingPage } from '../ai/SelfHealingLocator';
import { VisualAITester }  from '../ai/VisualAITester';
import { TestDataFactory } from '../ai/TestDataFactory';
import { AIClient }        from '../ai/AIClient';

export type AiFixtures = {
  aiPage:      SelfHealingPage;
  visualTester: VisualAITester;
  testData:    TestDataFactory;
};

export const test = base.extend<AiFixtures>({
  aiPage: async ({ page }, use) => {
    await use(new SelfHealingPage(page));
  },

  visualTester: async ({ page }, use) => {
    await use(new VisualAITester(page));
  },

  testData: async ({}, use) => {
    await use(new TestDataFactory());
  },
});

export { AIClient };
