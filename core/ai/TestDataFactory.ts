import { AIClient }                    from './AIClient';
import { GeneratedUser, GeneratedProduct, TestDataType } from './types';
import {
  GeneratedUserSchema,
  GeneratedProductSchema,
}                                       from './schema';
import { z }                            from 'zod';
import { logger }                       from '../utils/logger';

const SYSTEM_PROMPT = `
You are an expert test data engineer for an e-commerce automation framework.
Generate realistic, contextually appropriate test data for automated tests.

Application under test: https://automationexercise.com — e-commerce clothing/accessories site.
Customer base: UK / US.

Rules:
- Vary names, emails, and addresses across every call — never repeat the same data
- Emails must look like: firstname.lastname<nnn>@provider.tld
- Passwords: CapitalLetter + lowercase + digits + special char, 8-12 chars
- Phone: country-appropriate mobile (10-11 digits, no country-code prefix)
- Supported countries: United States, United Kingdom, Canada, Australia, India
- Product categories: Men's Clothing, Women's Clothing, Kids, Casual Wear, Sports, Formal Wear, Accessories
- Product price range: 10–200 USD
- Return ONLY valid JSON — no markdown, no code fences, no prose
`;

export class TestDataFactory {
  private readonly ai: AIClient;

  constructor() {
    this.ai = AIClient.getInstance();
  }

  // ── Single record generators ────────────────────────────────────────────────

  async generateUser(context?: string): Promise<GeneratedUser> {
    logger.info('[TestDataFactory] Generating user…');
    return this.ai.completeJson<GeneratedUser>(
      {
        systemPrompt: SYSTEM_PROMPT,
        userMessage:
          `Generate a single realistic user profile for an e-commerce site registration.` +
          (context ? ` Context: ${context}.` : '') +
          `\n\nReturn a single JSON object (no wrapper, no prose):\n` +
          `{"title":"Mr","firstName":"Jane","lastName":"Smith","email":"jane.smith123@gmail.com",` +
          `"password":"Pass@1234","phone":"07911123456",` +
          `"address":{"street":"12 Oak Road","city":"Manchester","state":"Greater Manchester","zipCode":"M1 2AB","country":"United Kingdom"},` +
          `"dateOfBirth":{"day":15,"month":6,"year":1990}}`,
        maxTokens: 400,
        operation: 'datagen',
      },
      GeneratedUserSchema,
    );
  }

  async generateProduct(context?: string): Promise<GeneratedProduct> {
    logger.info('[TestDataFactory] Generating product…');
    return this.ai.completeJson<GeneratedProduct>(
      {
        systemPrompt: SYSTEM_PROMPT,
        userMessage:
          `Generate a single realistic product for a clothing e-commerce store.` +
          (context ? ` Context: ${context}.` : '') +
          `\n\nReturn a single JSON object (no wrapper, no prose):\n` +
          `{"title":"Blue Slim Fit Shirt","price":49.99,"description":"Smart casual shirt for men","category":"Men's Clothing","searchTerms":["slim fit shirt","formal shirt","blue shirt"]}`,
        maxTokens: 250,
        operation: 'datagen',
      },
      GeneratedProductSchema,
    );
  }

  async generateSearchTerms(count = 5, context?: string): Promise<string[]> {
    logger.info(`[TestDataFactory] Generating ${count} search terms…`);
    const raw = await this.ai.completeJson<string[]>(
      {
        systemPrompt: SYSTEM_PROMPT,
        userMessage:
          `Generate ${count} realistic product search terms for a clothing e-commerce site.` +
          (context ? ` Context: ${context}.` : '') +
          `\n\nReturn a JSON array of ${count} strings. Example for count=3:\n["t-shirt","blue formal shirt","women summer dress"]`,
        maxTokens: 150,
        operation: 'datagen',
      },
      z.array(z.string().min(1)).min(1),
    );
    // Pad or trim to exact count so callers always get what they asked for
    if (raw.length >= count) return raw.slice(0, count);
    const filler = Array.from({ length: count - raw.length }, (_, i) => `clothing item ${i + 1}`);
    return [...raw, ...filler];
  }

  // ── Batch generator ─────────────────────────────────────────────────────────
  // Generates N records via sequential individual calls — more reliable on CPU
  // inference than a single large array request which can exceed token limits.

  async generateBatch<T>(
    type: TestDataType,
    count: number,
    context?: string,
  ): Promise<T[]> {
    logger.info(`[TestDataFactory] Generating batch of ${count} ${type}(s)…`);

    if (type === 'user') {
      const users: T[] = [];
      for (let i = 0; i < count; i++) {
        users.push(await this.generateUser(context) as unknown as T);
      }
      return users;
    }

    if (type === 'product') {
      const products: T[] = [];
      for (let i = 0; i < count; i++) {
        products.push(await this.generateProduct(context) as unknown as T);
      }
      return products;
    }

    // search terms — single call is fine since output is small
    return this.generateSearchTerms(count, context) as unknown as Promise<T[]>;
  }
}
