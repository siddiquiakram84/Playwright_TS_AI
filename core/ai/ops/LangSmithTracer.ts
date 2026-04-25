/**
 * LangSmith tracing — records every LLM call as a run visible at smith.langchain.com.
 *
 * Activated when ALL three env vars are present:
 *   LANGCHAIN_TRACING_V2=true
 *   LANGCHAIN_API_KEY=<your key>
 *   LANGCHAIN_PROJECT=<project name>
 *
 * When not configured every method is a no-op — zero overhead.
 *
 * Usage in AIClient:
 *   langSmithTracer.startRun(id, { name, inputs, tags });   // before LLM call
 *   langSmithTracer.endRun(id, { output, usage, error });   // after LLM call
 */

import * as crypto from 'crypto';
import { logger }  from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StartRunParams {
  /** Human-readable name shown in Smith (e.g. "heal", "datagen"). */
  name:      string;
  /** LLM messages sent to the model. */
  inputs: {
    messages: Array<{ role: string; content: string }>;
    provider?: string;
    model?:    string;
  };
  tags?: string[];
}

export interface EndRunParams {
  /** Raw text output from the model. */
  output:  string;
  /** Actual token counts — shown in Smith's usage panel. */
  usage?: {
    inputTokens:    number;
    outputTokens:   number;
    cacheHitTokens: number;
  };
  /** Non-null only when the call failed. */
  error?: string;
}

// ── Singleton tracer ──────────────────────────────────────────────────────────

class LangSmithTracer {
  private static _instance: LangSmithTracer;

  private enabled  = false;
  private project  = 'playwright-ai-framework';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;

  /** eventBus call-id  →  LangSmith UUID */
  private readonly pending = new Map<string, string>();

  static getInstance(): LangSmithTracer {
    if (!LangSmithTracer._instance) LangSmithTracer._instance = new LangSmithTracer();
    return LangSmithTracer._instance;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.client) return; // already initialised

    const tracing = process.env.LANGCHAIN_TRACING_V2;
    const apiKey  = process.env.LANGCHAIN_API_KEY;

    if (tracing !== 'true' || !apiKey) {
      logger.debug('[LangSmith] Tracing disabled (LANGCHAIN_TRACING_V2 or LANGCHAIN_API_KEY not set)');
      return;
    }

    try {
      const { Client } = await import('langsmith');
      this.client  = new Client({ apiKey });
      this.project = process.env.LANGCHAIN_PROJECT ?? 'playwright-ai-framework';
      this.enabled = true;
      logger.info(`[LangSmith] ✓ Tracing enabled → project: "${this.project}" (smith.langchain.com)`);
    } catch (err) {
      logger.warn('[LangSmith] Failed to load SDK — tracing disabled: ' + (err as Error).message);
    }
  }

  isEnabled(): boolean { return this.enabled; }
  getProject(): string { return this.project; }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget: open a LangSmith run BEFORE the LLM call.
   * Uses the same `id` the event bus already tracks, mapped to a proper UUID.
   */
  startRun(eventBusId: string, params: StartRunParams): void {
    if (!this.enabled) return;

    const lsId = crypto.randomUUID();
    this.pending.set(eventBusId, lsId);

    this.client.createRun({
      id:           lsId,
      name:         params.name,
      run_type:     'llm',
      inputs:       { messages: params.inputs.messages },
      project_name: this.project,
      tags:         params.tags ?? [],
      start_time:   Date.now(),
      extra: {
        metadata: {
          provider: params.inputs.provider,
          model:    params.inputs.model,
        },
      },
    }).catch((err: Error) => {
      logger.debug('[LangSmith] createRun failed: ' + err.message);
    });
  }

  /**
   * Fire-and-forget: close the LangSmith run AFTER the LLM call completes.
   */
  endRun(eventBusId: string, params: EndRunParams): void {
    if (!this.enabled) return;

    const lsId = this.pending.get(eventBusId);
    this.pending.delete(eventBusId);
    if (!lsId) return;

    const { inputTokens = 0, outputTokens = 0, cacheHitTokens = 0 } = params.usage ?? {};

    this.client.updateRun(lsId, {
      outputs: {
        generations: [{ text: params.output }],
        llm_output:  {
          token_usage: {
            prompt_tokens:          inputTokens,
            completion_tokens:      outputTokens,
            total_tokens:           inputTokens + outputTokens,
            cache_read_input_tokens: cacheHitTokens,
          },
        },
      },
      end_time: Date.now(),
      error:    params.error ?? null,
    }).catch((err: Error) => {
      logger.debug('[LangSmith] updateRun failed: ' + err.message);
    });
  }
}

export const langSmithTracer = LangSmithTracer.getInstance();
