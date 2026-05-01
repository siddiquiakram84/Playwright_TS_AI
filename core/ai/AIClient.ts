import type { ZodType as ZodSchema } from 'zod';
import { IAIProvider, CompleteParams, VisionParams } from './providers/IAIProvider';
import { OllamaProvider }     from './providers/OllamaProvider';
import { AnthropicProvider }  from './providers/AnthropicProvider';
import { aiEventBus }         from './ops/AIEventBus';
import { costTracker }        from './ops/CostTracker';
import { langSmithTracer }    from './ops/LangSmithTracer';
import { AIResponseCache, aiResponseCache } from './ops/AIResponseCache';
import { sanitizePrompt }     from './security/DataSanitizer';
import { logger }             from '../utils/logger';

type ProviderName = 'local' | 'anthropic';

const OLLAMA_UNAVAILABLE = '[OLLAMA_UNAVAILABLE]';

/**
 * Provider-agnostic AI client:
 *  - Strategy-pattern provider selection (AI_PROVIDER env var)
 *  - Auto-fallback: Ollama unavailable → Anthropic (if key set)
 *  - Singleton lifecycle with reset() on config change
 *  - DataSanitizer: strips API keys/PII before every LLM call
 *  - Real-time event emission (AIEventBus → dashboard)
 *  - Accurate token + cost tracking (CostTracker)
 *  - LangSmith tracing (every call → smith.langchain.com when enabled)
 *  - Zod-validated JSON completions (completeJson)
 */
export class AIClient {
  private static instance: AIClient | null = null;
  private readonly provider: IAIProvider;

  private constructor(provider: IAIProvider) {
    this.provider = provider;
    logger.info(`[AI] Provider → ${provider.name}`);
    langSmithTracer.init().catch(() => { /* non-fatal */ });
  }

  static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient(AIClient.createProvider());
    }
    return AIClient.instance;
  }

  static reset(): void { AIClient.instance = null; }

  get providerName(): string { return this.provider.name; }

  static clearCache(operation?: string): void { aiResponseCache.clear(operation); }
  static cacheStats() { return aiResponseCache.stats(); }

  // ── Text completion ──────────────────────────────────────────────────────────

  async complete(params: CompleteParams): Promise<string> {
    const sanitized = this.sanitize(params);
    return this.executeWithFallback(
      'complete',
      params.operation ?? 'general',
      sanitized,
      (provider, p) => provider.complete(p),
    );
  }

  // ── Vision completion ────────────────────────────────────────────────────────

  async completeWithVision(params: VisionParams): Promise<string> {
    const sanitized: VisionParams = {
      ...params,
      ...this.sanitize(params),
    };
    return this.executeWithFallback(
      'completeWithVision',
      params.operation ?? 'vision',
      sanitized,
      (provider, p) => provider.completeWithVision(p as VisionParams),
    );
  }

  // ── JSON completion ──────────────────────────────────────────────────────────

  async completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T> {
    const sanitized = this.sanitize(params);
    return this.executeWithFallback(
      'completeJson',
      params.operation ?? 'general',
      sanitized,
      (provider, p) => provider.completeJson(p, schema),
    );
  }

  // ── Core dispatcher with fallback ────────────────────────────────────────────

  private async executeWithFallback<TParams extends CompleteParams, TResult>(
    method:    string,
    operation: string,
    params:    TParams,
    invoke:    (provider: IAIProvider, params: TParams) => Promise<TResult>,
  ): Promise<TResult> {
    // ── Application-level response cache (skipped for vision) ───────────────
    let responseCacheKey: string | null = null;
    if (method !== 'completeWithVision') {
      await aiResponseCache.ensureLoaded();
      responseCacheKey = AIResponseCache.keyFor(this.provider.name, params.systemPrompt, params.userMessage);
      const cached = aiResponseCache.get<TResult>(responseCacheKey, params.operation ?? 'general');
      if (cached !== null) {
        logger.debug(`[AIClient] Response cache hit for "${operation}"`);
        return cached;
      }
    }

    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    langSmithTracer.startRun(id, {
      name:  operation,
      inputs: {
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user',   content: params.userMessage  },
        ],
        provider: this.provider.name,
      },
      tags: [this.provider.name, operation, method],
    });

    let activeProvider = this.provider;

    try {
      // Enforce budget limits before every LLM call — inside try so recordFailure fires on breach
      const budget = costTracker.checkLimits();
      if (budget.exceeded) {
        const totals = costTracker.getSessionTotals();
        aiEventBus.emitBudgetExceeded({
          type:             budget.type!,
          used:             budget.used,
          limit:            budget.limit,
          calls:            totals.calls,
          estimatedCostUsd: totals.estimatedCostUsd,
          timestamp:        Date.now(),
        });
        throw new Error(
          `[AIClient] Budget exceeded — ${budget.type === 'token'
            ? `${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} tokens used`
            : `$${budget.used.toFixed(4)} / $${budget.limit.toFixed(4)} cost limit reached`}`,
        );
      }

      let result = await invoke(activeProvider, params);

      // Detect Ollama offline sentinel — attempt Anthropic fallback
      if (typeof result === 'string' && result === OLLAMA_UNAVAILABLE) {
        const fallback = AIClient.tryBuildAnthropicProvider();
        if (fallback) {
          logger.warn(`[AIClient] Ollama unavailable — falling back to Anthropic for "${operation}"`);
          aiEventBus.emitAdmin({
            action:    'provider-fallback',
            provider:  'anthropic',
            timestamp: Date.now(),
          });
          activeProvider = fallback;
          result = await invoke(activeProvider, params);
        } else {
          throw new Error('[AIClient] Ollama is offline and no ANTHROPIC_API_KEY is set. Start Ollama or set ANTHROPIC_API_KEY in .env');
        }
      }

      const latencyMs = Date.now() - startedAt;
      const { inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens } = activeProvider.lastUsage;
      const cost = costTracker.record(activeProvider.name, inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens);

      if (responseCacheKey) aiResponseCache.set(responseCacheKey, params.operation ?? 'general', result);

      aiEventBus.emitLLMEnd({
        id, provider: activeProvider.name, operation, timestamp: Date.now(),
        latencyMs, inputTokens, outputTokens, cacheHitTokens,
        costUsd: cost, success: true,
      });

      langSmithTracer.endRun(id, {
        output: typeof result === 'string' ? result : JSON.stringify(result),
        usage: { inputTokens, outputTokens, cacheHitTokens },
      });

      logger.debug(`[AI] ${operation} in ${latencyMs}ms (${activeProvider.name}) in=${inputTokens} out=${outputTokens}`);
      return result;

    } catch (err) {
      // If primary is Ollama and the error is connectivity, attempt Anthropic fallback
      if (activeProvider.name === 'ollama' && this.isConnectivityError(err)) {
        const fallback = AIClient.tryBuildAnthropicProvider();
        if (fallback) {
          logger.warn(`[AIClient] Ollama unreachable — falling back to Anthropic for "${operation}"`);
          aiEventBus.emitAdmin({
            action:    'provider-fallback',
            provider:  'anthropic',
            timestamp: Date.now(),
          });
          try {
            const fbResult = await invoke(fallback, params);
            const latencyMs = Date.now() - startedAt;
            const { inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens } = fallback.lastUsage;
            const cost = costTracker.record(fallback.name, inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens);
            if (responseCacheKey) aiResponseCache.set(responseCacheKey, params.operation ?? 'general', fbResult);

            aiEventBus.emitLLMEnd({
              id, provider: fallback.name, operation, timestamp: Date.now(),
              latencyMs, inputTokens, outputTokens, cacheHitTokens,
              costUsd: cost, success: true,
            });
            langSmithTracer.endRun(id, {
              output: typeof fbResult === 'string' ? fbResult : JSON.stringify(fbResult),
              usage: { inputTokens, outputTokens, cacheHitTokens },
            });
            return fbResult;
          } catch (fbErr) {
            // Fallback also failed — surface original error + fallback error
            const msg = `Primary: ${(err as Error).message} | Fallback: ${(fbErr as Error).message}`;
            this.recordFailure(id, fallback.name, operation, startedAt, msg);
            throw new Error(`[AIClient] Both providers failed for "${operation}": ${msg}`);
          }
        }
      }

      const msg = (err as Error).message;
      this.recordFailure(id, activeProvider.name, operation, startedAt, msg);
      throw err;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private sanitize(params: CompleteParams): CompleteParams {
    const { systemPrompt, userMessage, totalRedactions } = sanitizePrompt(
      params.systemPrompt,
      params.userMessage,
    );
    if (totalRedactions > 0) {
      logger.warn(`[AIClient] DataSanitizer removed ${totalRedactions} sensitive value(s) from prompt`);
    }
    return { ...params, systemPrompt, userMessage };
  }

  private isConnectivityError(err: unknown): boolean {
    const msg = (err as Error)?.message ?? '';
    return (
      msg.includes('[Ollama] Cannot reach') ||
      msg.includes('fetch failed') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('OLLAMA_UNAVAILABLE')
    );
  }

  private recordFailure(
    id: string, provider: string, operation: string, startedAt: number, msg: string,
  ): void {
    aiEventBus.emitLLMEnd({
      id, provider, operation, timestamp: Date.now(),
      latencyMs: Date.now() - startedAt,
      inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
      costUsd: 0, success: false, error: msg,
    });
    langSmithTracer.endRun(id, { output: '', error: msg });
  }

  private static tryBuildAnthropicProvider(): IAIProvider | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    try { return new AnthropicProvider(); } catch { return null; }
  }

  // ── Factory ──────────────────────────────────────────────────────────────────

  private static createProvider(): IAIProvider {
    const name = (process.env.AI_PROVIDER ?? 'local') as ProviderName;
    switch (name) {
      case 'anthropic': return new AnthropicProvider();
      case 'local':
      default:          return new OllamaProvider();
    }
  }
}
