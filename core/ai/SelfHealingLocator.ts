import * as fs from 'fs/promises';
import * as path from 'path';
import { Page, Locator } from '@playwright/test';
import { AIClient } from './AIClient';
import { HealedSelectorsCache, SelectorAlternative, ElementFingerprint } from './types';
import { SelectorAlternativesSchema } from './schema';
import { aiEventBus } from './ops/AIEventBus';
import { logger } from '../utils/logger';

const CACHE_PATH = path.join(process.cwd(), 'core', 'ai', 'healed-selectors.json');
const HEAL_TIMEOUT = 3000;

const SYSTEM_PROMPT = `
You are a DOM expert. Find the correct CSS selector when the given one fails.
Return ONLY a JSON array of 3 alternatives ranked by confidence:
[{"selector":"...","confidence":0.95},{"selector":"...","confidence":0.85},{"selector":"...","confidence":0.70}]
Prefer data-qa, data-testid, id, name attributes. No prose, no markdown.
`;

async function loadCache(): Promise<HealedSelectorsCache> {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as HealedSelectorsCache;
  } catch {
    return {};
  }
}

async function captureFingerprint(page: Page, selector: string): Promise<ElementFingerprint> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { role: null, text: null, testId: null, name: null, ariaLabel: null };
    return {
      role:      el.getAttribute('role'),
      text:      el.textContent?.trim().substring(0, 100) ?? null,
      testId:    el.getAttribute('data-testid') ?? el.getAttribute('data-qa'),
      name:      el.getAttribute('name'),
      ariaLabel: el.getAttribute('aria-label'),
    };
  }, selector);
}

function fingerprintMatches(stored: ElementFingerprint, live: ElementFingerprint): boolean {
  // At least two non-null fields must match; a fully null stored fingerprint is treated as unknown.
  const fields: (keyof ElementFingerprint)[] = ['role', 'testId', 'name', 'ariaLabel', 'text'];
  let matches = 0;
  let comparable = 0;
  for (const f of fields) {
    if (stored[f] !== null) {
      comparable++;
      if (stored[f] === live[f]) matches++;
    }
  }
  return comparable === 0 || matches >= Math.min(2, comparable);
}

async function saveCache(cache: HealedSelectorsCache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

async function healSelector(
  page: Page,
  selector: string,
  ai: AIClient,
): Promise<string> {
  const url = page.url();
  const cacheKey = `${url} > ${selector}`;

  const cache = await loadCache();
  if (cache[cacheKey]) {
    const entry = cache[cacheKey];
    if (entry.fingerprint) {
      try {
        await page.locator(entry.healed).waitFor({ state: 'attached', timeout: HEAL_TIMEOUT });
        const live = await captureFingerprint(page, entry.healed);
        if (fingerprintMatches(entry.fingerprint, live)) {
          logger.info(`[SelfHealing] Cache hit (fingerprint ok) "${selector}" → "${entry.healed}"`);
          return entry.healed;
        }
        logger.warn(`[SelfHealing] Cached selector "${entry.healed}" resolves but fingerprint drifted — re-healing`);
        delete cache[cacheKey];
        await saveCache(cache);
      } catch {
        // cached selector no longer attaches; fall through to re-heal
        delete cache[cacheKey];
        await saveCache(cache);
      }
    } else {
      // legacy entry without fingerprint — trust it but upgrade on next heal
      logger.info(`[SelfHealing] Cache hit (no fingerprint) "${selector}" → "${entry.healed}"`);
      return entry.healed;
    }
  }

  logger.warn(`[SelfHealing] Selector failed: "${selector}" on ${url} — invoking AI healing…`);

  // Focused DOM snapshot: only interactive elements from the nearest form (or page body).
  // Small context = faster mistral inference on CPU (~3-4 min vs 7+ min for a 6K char dump).
  const dom = await page.evaluate(() => {
    const root = document.querySelector('form') ?? document.body;
    const items: string[] = [];
    root.querySelectorAll('input, button, select, textarea, label').forEach(el => {
      const html = el.outerHTML.replace(/\s+/g, ' ').trim();
      items.push(html.substring(0, 250));
    });
    // Fall back to page-wide scan if form has fewer than 3 interactive elements
    if (items.length < 3) {
      document.querySelectorAll('input, button, select, textarea').forEach(el => {
        const html = el.outerHTML.replace(/\s+/g, ' ').trim();
        if (!items.includes(html.substring(0, 250))) items.push(html.substring(0, 250));
      });
    }
    return items.slice(0, 20).join('\n');
  });

  // Use text-only healing — DOM context is authoritative for selector discovery,
  // and avoids loading vision models that can destabilise Ollama's memory.
  const alternatives: SelectorAlternative[] = await ai.completeJson(
    {
      systemPrompt: SYSTEM_PROMPT,
      userMessage:
        `Page URL: ${url}\n` +
        `Failed selector: "${selector}"\n\n` +
        `Interactive elements on page:\n${dom}\n\n` +
        `Return 3 alternative selectors as a JSON array.`,
      maxTokens: 400,
      operation: 'healing',
    },
    SelectorAlternativesSchema,
  );

  if (!alternatives.length) {
    throw new Error(`[SelfHealing] AI returned no alternatives for selector "${selector}"`);
  }

  for (const alt of alternatives) {
    try {
      const loc = page.locator(alt.selector);
      await loc.waitFor({ state: 'attached', timeout: HEAL_TIMEOUT });
      logger.info(
        `[SelfHealing] ✔ Healed: "${selector}" → "${alt.selector}" ` +
        `(confidence: ${alt.confidence}, reason: ${alt.reasoning})`,
      );
      const fingerprint = await captureFingerprint(page, alt.selector);
      cache[cacheKey] = {
        original: selector,
        healed: alt.selector,
        url,
        confidence: alt.confidence,
        timestamp: new Date().toISOString(),
        fingerprint,
      };
      await saveCache(cache);
      aiEventBus.emitHealing({
        selector,
        url,
        healed:     alt.selector,
        confidence: alt.confidence,
        success:    true,
        timestamp:  Date.now(),
      });
      return alt.selector;
    } catch {
      logger.debug(`[SelfHealing] Alternative failed: "${alt.selector}"`);
    }
  }

  aiEventBus.emitHealing({ selector, url, success: false, timestamp: Date.now() });
  throw new Error(
    `[SelfHealing] All AI-suggested alternatives failed for selector "${selector}" on ${url}`,
  );
}

/**
 * A Playwright Locator wrapper that auto-heals broken selectors using AI.
 *
 * When an action (fill, click, etc.) throws a TimeoutError, the locator:
 * 1. Captures a DOM snapshot of the page
 * 2. Sends it to the AI provider (text-only — avoids vision model memory pressure)
 * 3. Tries each suggested alternative in confidence order
 * 4. Persists the winning selector to core/ai/healed-selectors.json
 */
export class SelfHealingLocator {
  private currentSelector: string;
  private wasHealed = false;

  constructor(
    private readonly page: Page,
    originalSelector: string,
    private readonly ai: AIClient,
  ) {
    this.currentSelector = originalSelector;
  }

  /** Resolves the Playwright Locator, healing if the element is not found. */
  private async resolve(timeout = 8000): Promise<Locator> {
    try {
      const loc = this.page.locator(this.currentSelector);
      await loc.waitFor({ state: 'attached', timeout });
      return loc;
    } catch {
      this.currentSelector = await healSelector(this.page, this.currentSelector, this.ai);
      this.wasHealed = true;
      return this.page.locator(this.currentSelector);
    }
  }

  get isHealed(): boolean { return this.wasHealed; }
  get selector(): string  { return this.currentSelector; }

  async fill(text: string, options?: Parameters<Locator['fill']>[1]): Promise<void> {
    const loc = await this.resolve();
    await loc.fill(text, options);
  }

  async click(options?: Parameters<Locator['click']>[0]): Promise<void> {
    const loc = await this.resolve();
    await loc.click(options);
  }

  async type(text: string, options?: Parameters<Locator['type']>[1]): Promise<void> {
    const loc = await this.resolve();
    await loc.type(text, options);
  }

  async getAttribute(name: string): Promise<string | null> {
    const loc = await this.resolve();
    return loc.getAttribute(name);
  }

  async innerText(): Promise<string> {
    const loc = await this.resolve();
    return loc.innerText();
  }

  async isVisible(): Promise<boolean> {
    try {
      const loc = await this.resolve(3000);
      return loc.isVisible();
    } catch {
      return false;
    }
  }

  /** Escape hatch — returns the raw Playwright Locator after healing if needed. */
  async raw(): Promise<Locator> {
    return this.resolve();
  }
}

/**
 * A Page wrapper that returns SelfHealingLocators instead of raw Playwright Locators.
 */
export class SelfHealingPage {
  private readonly ai: AIClient;

  constructor(readonly native: Page) {
    this.ai = AIClient.getInstance();
  }

  locator(selector: string): SelfHealingLocator {
    return new SelfHealingLocator(this.native, selector, this.ai);
  }

  async navigate(url: string): Promise<void> {
    await this.native.goto(url, { waitUntil: 'domcontentloaded' });
  }

  get url(): string { return this.native.url(); }
}
