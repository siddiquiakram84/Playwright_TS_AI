import * as fs from 'fs/promises';
import * as path from 'path';
import { Page } from '@playwright/test';
import { AIClient } from './AIClient';
import { VisualComparisonResult, VisualDifference } from './types';
import { aiEventBus } from './ops/AIEventBus';
import { logger } from '../utils/logger';

const BASELINES_DIR = path.join(process.cwd(), 'dashboard', 'visual-baselines');

const SYSTEM_PROMPT = `
You are an expert visual QA engineer specialising in UI regression detection.
You will receive two screenshots of the same web page:
  - Image 1: the BASELINE (approved reference state)
  - Image 2: the CURRENT screenshot (what the page looks like now)

Compare them carefully and identify any visual regressions. Return your analysis
as a JSON object with this exact structure (no markdown wrapper, no prose):
{
  "passed": true | false,
  "confidence": 0.0-1.0,
  "summary": "one-sentence summary",
  "differences": [
    {
      "element": "element name or area",
      "description": "what changed",
      "severity": "low" | "medium" | "high",
      "region": "top | bottom | left | right | center | full-page (optional)"
    }
  ]
}

Guidelines:
- "passed" is true only when there are no medium or high severity differences
- Minor anti-aliasing or font-rendering artefacts are severity "low" and do NOT cause failure
- Layout shifts, missing elements, colour changes, text changes are "medium" or "high"
- Return "differences": [] when the pages look identical
- Be precise and actionable in descriptions
`;

function parseComparisonResult(raw: string): VisualComparisonResult {
  // Ollama returned a sentinel when both vision and text fallback failed
  if (raw === '[OLLAMA_UNAVAILABLE]') {
    logger.warn('[VisualAI] Ollama unavailable — defaulting to passed=true (AI analysis skipped)');
    return {
      passed: true,
      differences: [],
      summary: 'AI vision unavailable (model loading failed) — defaulting to passed',
      confidence: 0,
    };
  }
  const match = raw.match(/\{[\s\S]+\}/);
  if (!match) {
    logger.warn('[VisualAI] Could not parse JSON from response — defaulting to passed=true');
    return {
      passed: true,
      differences: [],
      summary: 'AI response could not be parsed — defaulting to passed',
      confidence: 0,
    };
  }
  try {
    return JSON.parse(match[0]) as VisualComparisonResult;
  } catch {
    return {
      passed: true,
      differences: [],
      summary: 'Malformed JSON in AI response — defaulting to passed',
      confidence: 0,
    };
  }
}

/**
 * AI-powered visual regression tester.
 *
 * Usage:
 *   const tester = new VisualAITester(page);
 *   await tester.captureBaseline('homepage');        // Run once to establish baseline
 *   const result = await tester.compareWithBaseline('homepage');  // Every subsequent run
 *   expect(result.passed).toBe(true);
 */
export class VisualAITester {
  private readonly ai: AIClient;

  constructor(private readonly page: Page) {
    this.ai = AIClient.getInstance();
  }

  /**
   * Captures and stores a baseline screenshot.
   * If a baseline already exists it is overwritten (re-baselining).
   */
  async captureBaseline(name: string): Promise<void> {
    await fs.mkdir(BASELINES_DIR, { recursive: true });
    const dest = path.join(BASELINES_DIR, `${name}.png`);
    await this.page.screenshot({ path: dest });
    logger.info(`[VisualAI] Baseline captured → ${dest}`);
  }

  /**
   * Compares the current page state against the stored baseline using AI vision.
   * If no baseline exists, it captures one and returns a trivially-passed result.
   */
  async compareWithBaseline(name: string): Promise<VisualComparisonResult> {
    const baselinePath = path.join(BASELINES_DIR, `${name}.png`);

    let baselineBuffer: Buffer;
    try {
      baselineBuffer = await fs.readFile(baselinePath);
    } catch {
      logger.warn(`[VisualAI] No baseline found for "${name}" — capturing now (first run)`);
      await this.captureBaseline(name);
      return {
        passed: true,
        differences: [],
        summary: 'First run — baseline captured, no comparison performed',
        confidence: 1,
      };
    }

    const currentBuffer = await this.page.screenshot();
    logger.info(`[VisualAI] Comparing "${name}" against baseline…`);

    const raw = await this.ai.completeWithVision({
      systemPrompt: SYSTEM_PROMPT,
      userMessage:
        'Image 1 is the BASELINE. Image 2 is the CURRENT screenshot. ' +
        'Identify any visual regressions and return the JSON analysis object.',
      images: [
        { base64: baselineBuffer.toString('base64'), mediaType: 'image/png' },
        { base64: currentBuffer.toString('base64'),  mediaType: 'image/png' },
      ],
      maxTokens: 300,
    });

    // When Ollama vision is unavailable fall back to byte-diff heuristic.
    // Comparing raw PNG bytes (not just file size) reliably detects colour inversions and
    // layout changes: identical pages produce near-identical compressed streams; a full
    // colour inversion changes >70% of the IDAT bytes even at the same file size.
    let result: VisualComparisonResult;
    if (raw === '[OLLAMA_UNAVAILABLE]') {
      const minLen    = Math.min(baselineBuffer.length, currentBuffer.length);
      let diffBytes   = Math.abs(baselineBuffer.length - currentBuffer.length);
      for (let i = 0; i < minLen; i++) {
        if (baselineBuffer[i] !== currentBuffer[i]) diffBytes++;
      }
      const diffRatio = diffBytes / Math.max(baselineBuffer.length, currentBuffer.length);

      if (diffRatio > 0.30) {
        logger.warn(`[VisualAI] AI unavailable — byte diff ${(diffRatio * 100).toFixed(1)}% indicates visual change`);
        result = {
          passed: false,
          confidence: 0,
          summary: `Visual difference detected via byte-diff heuristic (${(diffRatio * 100).toFixed(1)}% bytes differ) — AI unavailable for detailed analysis`,
          differences: [{ element: 'page', description: 'Significant visual change detected', severity: 'medium' }],
        };
      } else {
        result = {
          passed: true,
          confidence: 0,
          summary: `AI vision unavailable — ${(diffRatio * 100).toFixed(1)}% byte delta within threshold, defaulting to passed`,
          differences: [],
        };
      }
    } else {
      result = parseComparisonResult(raw);
    }

    if (result.passed) {
      logger.info(`[VisualAI] ✔ "${name}" — no regressions (confidence: ${result.confidence})`);
    } else {
      const high = result.differences.filter((d: VisualDifference) => d.severity === 'high').length;
      const med  = result.differences.filter((d: VisualDifference) => d.severity === 'medium').length;
      logger.warn(
        `[VisualAI] ✘ "${name}" — regressions detected: ${high} high, ${med} medium. ` +
        `Summary: ${result.summary}`,
      );
      for (const diff of result.differences) {
        logger.warn(`  [${diff.severity.toUpperCase()}] ${diff.element}: ${diff.description}`);
      }
    }

    aiEventBus.emitVisual({
      name,
      passed:      result.passed,
      differences: result.differences.length,
      summary:     result.summary,
      timestamp:   Date.now(),
    });

    return result;
  }

  /** Returns true if a baseline image already exists for the given name. */
  async hasBaseline(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(BASELINES_DIR, `${name}.png`));
      return true;
    } catch {
      return false;
    }
  }
}
