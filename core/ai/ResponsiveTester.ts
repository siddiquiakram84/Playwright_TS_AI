import { Page }      from '@playwright/test';
import { AIClient }  from './AIClient';
import { AIImage }   from './providers/IAIProvider';
import { aiEventBus } from './ops/AIEventBus';
import { logger }    from '../utils/logger';

// ── Viewport matrix ───────────────────────────────────────────────────────────

export interface ViewportProfile {
  name:     string;
  width:    number;
  height:   number;
  zoom:     number;   // CSS zoom factor — 1.0 = 100%, 1.5 = 150%
  isMobile: boolean;
}

export const VIEWPORT_MATRIX: ViewportProfile[] = [
  { name: 'mobile-sm',     width: 375,  height: 667,  zoom: 1.0, isMobile: true  },
  { name: 'mobile-lg',     width: 428,  height: 926,  zoom: 1.0, isMobile: true  },
  { name: 'tablet',        width: 768,  height: 1024, zoom: 1.0, isMobile: false },
  { name: 'desktop',       width: 1280, height: 720,  zoom: 1.0, isMobile: false },
  { name: 'desktop-75pct', width: 1280, height: 720,  zoom: 0.75, isMobile: false },
  { name: 'desktop-125pct',width: 1280, height: 720,  zoom: 1.25, isMobile: false },
  { name: 'desktop-150pct',width: 1280, height: 720,  zoom: 1.50, isMobile: false },
  { name: 'wide-1920',     width: 1920, height: 1080, zoom: 1.0, isMobile: false },
  { name: 'uhd-2560',      width: 2560, height: 1440, zoom: 1.0, isMobile: false },
];

// ── Result types ──────────────────────────────────────────────────────────────

export interface ResponsiveIssue {
  severity:    'critical' | 'warning' | 'info';
  description: string;
  element?:    string;
}

export interface ResponsiveResult {
  profile:        ViewportProfile;
  passed:         boolean;
  score:          number;  // 0–100
  issues:         ResponsiveIssue[];
  overflowX:      boolean;
  overflowY:      boolean;
  interactableElements: number;
  hiddenElements: number;
  summary:        string;
  timestamp:      number;
}

// ── ResponsiveTester ──────────────────────────────────────────────────────────

export class ResponsiveTester {
  private readonly ai: AIClient;

  constructor(ai?: AIClient) {
    this.ai = ai ?? AIClient.getInstance();
  }

  /**
   * Apply a viewport profile to the given page.
   * Uses CDP Emulation.setDeviceMetricsOverride for deviceScaleFactor,
   * and injects CSS zoom for browser-level zoom simulation.
   */
  async applyProfile(page: Page, profile: ViewportProfile): Promise<void> {
    await page.setViewportSize({ width: profile.width, height: profile.height });

    // Apply CSS zoom to simulate browser zoom (Ctrl +/-)
    if (profile.zoom !== 1.0) {
      await page.evaluate((zoom: number) => {
        (document.documentElement as HTMLElement).style.zoom = String(zoom);
      }, profile.zoom);
    } else {
      await page.evaluate(() => {
        (document.documentElement as HTMLElement).style.zoom = '';
      });
    }

    logger.debug(`[Responsive] Profile applied: ${profile.name} (${profile.width}×${profile.height} @ ${Math.round(profile.zoom * 100)}%)`);
  }

  /**
   * Run DOM-level structural checks — no AI involved, fast.
   * Returns raw metrics that feed the AI prompt and standalone assertions.
   */
  async checkDom(page: Page): Promise<{
    overflowX:            boolean;
    overflowY:            boolean;
    interactableElements: number;
    hiddenElements:       number;
    overflowingElements:  string[];
    truncatedTexts:       string[];
    overlappingElements:  string[];
  }> {
    return page.evaluate(() => {
      const vw = window.innerWidth;

      // Horizontal overflow — most common responsive break
      const overflowX = document.documentElement.scrollWidth > vw + 2;

      // Vertical overflow on critical containers (navigation, hero)
      const header = document.querySelector('header, nav, [role="banner"]');
      const overflowY = header ? header.scrollHeight > (window.innerHeight * 0.6) : false;

      // Elements that bleed past the viewport right edge
      const overflowingElements: string[] = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 5) {
          const id  = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string'
            ? '.' + el.className.split(' ')[0] : '';
          overflowingElements.push(`${el.tagName.toLowerCase()}${id}${cls}`);
        }
      });

      // Interactable elements with zero or near-zero touch target size
      const interactable = Array.from(
        document.querySelectorAll('button, a, input, select, textarea, [role="button"]'),
      );
      let hiddenElements = 0;
      interactable.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          hiddenElements++;
        }
      });

      // Truncated text nodes (overflow:hidden + text-overflow)
      const truncatedTexts: string[] = [];
      document.querySelectorAll('p, h1, h2, h3, h4, span, li, td').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' && style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) {
          const text = el.textContent?.trim().substring(0, 40) ?? '';
          if (text) truncatedTexts.push(text);
        }
      });

      // Simple overlap detection: elements at the same position
      const overlappingElements: string[] = [];
      const seen = new Map<string, Element>();
      document.querySelectorAll('nav *, header *').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const key = `${Math.round(rect.left)},${Math.round(rect.top)}`;
        if (seen.has(key)) {
          overlappingElements.push(`${el.tagName.toLowerCase()} @ ${key}`);
        } else {
          seen.set(key, el);
        }
      });

      return {
        overflowX,
        overflowY,
        interactableElements: interactable.length,
        hiddenElements,
        overflowingElements:  [...new Set(overflowingElements)].slice(0, 10),
        truncatedTexts:       [...new Set(truncatedTexts)].slice(0, 5),
        overlappingElements:  [...new Set(overlappingElements)].slice(0, 5),
      };
    });
  }

  /**
   * Full AI-powered responsive analysis for one viewport.
   * Takes a screenshot, runs DOM checks, sends both to the vision LLM.
   */
  async analyzeViewport(
    page:      Page,
    profile:   ViewportProfile,
    pageName?: string,
  ): Promise<ResponsiveResult> {
    await this.applyProfile(page, profile);
    await page.waitForLoadState('networkidle').catch(() => { /* timeout is fine */ });

    const [screenshotBuf, domMetrics] = await Promise.all([
      page.screenshot({ type: 'jpeg', quality: 80, fullPage: false }),
      this.checkDom(page),
    ]);
    const screenshot: AIImage = {
      base64:    screenshotBuf.toString('base64'),
      mediaType: 'image/jpeg',
    };

    const domSummary = [
      domMetrics.overflowX           ? '⚠ horizontal overflow detected' : '',
      domMetrics.overflowingElements.length > 0
        ? `⚠ overflowing: ${domMetrics.overflowingElements.slice(0, 3).join(', ')}` : '',
      domMetrics.truncatedTexts.length > 0
        ? `⚠ truncated: ${domMetrics.truncatedTexts.slice(0, 2).join(', ')}` : '',
      domMetrics.overlappingElements.length > 0
        ? `⚠ overlaps: ${domMetrics.overlappingElements.slice(0, 2).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `
You are a senior UI/UX QA engineer specialising in responsive web design.
Analyse the provided screenshot and DOM report to find layout issues.

Return ONLY valid JSON matching this structure:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": [{"severity":"critical|warning|info","description":"string","element":"optional selector"}],
  "summary": "one-line overall assessment"
}

Score guide: 90-100 = no issues, 70-89 = minor, 50-69 = notable, below 50 = critical breaks.
Severity guide:
  critical = content hidden or inaccessible, buttons unclickable, text unreadable
  warning  = poor spacing, minor overflow, small tap targets
  info     = cosmetic or low-priority suggestion
`.trim();

    const userMessage = `
Viewport: ${profile.name} — ${profile.width}×${profile.height} @ ${Math.round(profile.zoom * 100)}% zoom
Page: ${pageName ?? page.url()}

DOM Analysis:
- Horizontal overflow: ${domMetrics.overflowX}
- Hidden interactive elements: ${domMetrics.hiddenElements} of ${domMetrics.interactableElements}
${domSummary || '- No DOM issues detected'}

Analyse the screenshot for responsive layout quality at this viewport and zoom level.
`.trim();

    let passed   = !domMetrics.overflowX && domMetrics.overflowingElements.length === 0;
    let score    = passed ? 85 : 55;
    let issues: ResponsiveIssue[] = [];
    let summary  = passed ? 'No critical issues detected' : 'Layout issues found';

    try {
      const raw = await this.ai.completeWithVision({
        systemPrompt,
        userMessage,
        images: [screenshot],
        maxTokens: 800,
        operation: 'vision',
      });

      const jsonMatch = raw.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        passed  = parsed.passed  ?? passed;
        score   = parsed.score   ?? score;
        issues  = parsed.issues  ?? issues;
        summary = parsed.summary ?? summary;
      }
    } catch (err) {
      // Fallback to DOM-only result — never block the test
      logger.warn(`[Responsive] Vision analysis failed for ${profile.name}: ${(err as Error).message}`);
      if (domMetrics.overflowX) {
        issues.push({ severity: 'critical', description: 'Horizontal scroll detected — content overflows viewport' });
      }
      domMetrics.overflowingElements.forEach(el => {
        issues.push({ severity: 'warning', description: `Element bleeds past right edge`, element: el });
      });
    }

    const result: ResponsiveResult = {
      profile,
      passed,
      score,
      issues,
      overflowX:            domMetrics.overflowX,
      overflowY:            domMetrics.overflowY,
      interactableElements: domMetrics.interactableElements,
      hiddenElements:       domMetrics.hiddenElements,
      summary,
      timestamp:            Date.now(),
    };

    aiEventBus.emitVisual({
      name:        `Responsive: ${profile.name} (${pageName ?? 'page'})`,
      passed:      result.passed,
      differences: result.issues.filter(i => i.severity === 'critical').length,
      summary:     result.summary,
      timestamp:   result.timestamp,
    });

    logger.info(
      `[Responsive] ${profile.name} → ${passed ? 'PASS' : 'FAIL'} score=${score} issues=${issues.length}`,
    );

    return result;
  }

  /**
   * Run the full viewport matrix against the current page URL.
   * Pass a subset of VIEWPORT_MATRIX to limit which profiles are tested.
   */
  async runMatrix(
    page:      Page,
    profiles:  ViewportProfile[] = VIEWPORT_MATRIX,
    pageName?: string,
  ): Promise<ResponsiveResult[]> {
    const results: ResponsiveResult[] = [];
    const originalUrl = page.url();

    for (const profile of profiles) {
      // Re-navigate to ensure clean state for each viewport
      if (page.url() !== originalUrl) {
        await page.goto(originalUrl, { waitUntil: 'domcontentloaded' });
      }
      const result = await this.analyzeViewport(page, profile, pageName);
      results.push(result);
    }

    // Restore to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => { (document.documentElement as HTMLElement).style.zoom = ''; });

    return results;
  }
}
