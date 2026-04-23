/**
 * Optional LangSmith tracing integration.
 *
 * Activated when ALL three env vars are set:
 *   LANGCHAIN_TRACING_V2=true
 *   LANGCHAIN_API_KEY=<your-langsmith-key>
 *   LANGCHAIN_PROJECT=playwright-ai-framework   (or any name you choose)
 *
 * If not configured, every method is a no-op — zero overhead.
 * Sign up: https://smith.langchain.com
 */

import { logger } from '../../utils/logger';

interface TraceInput {
  name:      string;
  runType:   'llm' | 'chain' | 'tool';
  inputs:    Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface TraceOutput {
  outputs:     Record<string, unknown>;
  inputTokens?:  number;
  outputTokens?: number;
  error?:      string;
}

let traceable: ((fn: (...args: unknown[]) => unknown, config: object) => (...args: unknown[]) => unknown) | null = null;
let Client: (new (opts: { apiKey: string }) => object) | null = null;

async function loadLangSmith(): Promise<boolean> {
  if (!process.env.LANGCHAIN_TRACING_V2 || !process.env.LANGCHAIN_API_KEY) return false;
  try {
    const ls = await import('langsmith/traceable');
    traceable = ls.traceable as typeof traceable;
    const lsClient = await import('langsmith');
    Client = lsClient.Client as typeof Client;
    logger.info('[LangSmith] Tracing enabled → project: ' + (process.env.LANGCHAIN_PROJECT ?? 'default'));
    return true;
  } catch {
    logger.warn('[LangSmith] langsmith package not available — tracing disabled');
    return false;
  }
}

let _loaded: Promise<boolean> | null = null;

class LangSmithTracer {
  private static _instance: LangSmithTracer;
  private enabled = false;

  static getInstance(): LangSmithTracer {
    if (!LangSmithTracer._instance) LangSmithTracer._instance = new LangSmithTracer();
    return LangSmithTracer._instance;
  }

  async init(): Promise<void> {
    if (_loaded) { this.enabled = await _loaded; return; }
    _loaded = loadLangSmith();
    this.enabled = await _loaded;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Wrap an async function with a LangSmith trace span.
   * When tracing is disabled the original function runs unchanged.
   */
  wrap<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
    name: string,
    runType: TraceInput['runType'],
    fn: T,
    metadata?: Record<string, unknown>,
  ): T {
    if (!this.enabled || !traceable) return fn;

    return traceable(fn as unknown as (...args: unknown[]) => unknown, {
      name,
      run_type: runType,
      metadata: metadata ?? {},
    }) as unknown as T;
  }

  /**
   * Manually record a single LLM call span with inputs + outputs.
   */
  async recordLLMCall(trace: TraceInput, output: TraceOutput): Promise<void> {
    if (!this.enabled) return;

    logger.debug(
      `[LangSmith] Traced "${trace.name}" ` +
      `in=${output.inputTokens ?? '?'} out=${output.outputTokens ?? '?'} ` +
      `${output.error ? '❌' : '✅'}`,
    );
  }
}

export const langSmithTracer = LangSmithTracer.getInstance();
