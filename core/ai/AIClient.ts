import type { ZodSchema } from 'zod';
import { IAIProvider, CompleteParams, VisionParams } from './providers/IAIProvider';
import { OllamaProvider }     from './providers/OllamaProvider';
import { AnthropicProvider }  from './providers/AnthropicProvider';
import { aiEventBus }         from './ops/AIEventBus';
import { costTracker }        from './ops/CostTracker';
import { langSmithTracer }    from './ops/LangSmithTracer';
import { logger }             from '../utils/logger';

type ProviderName = 'local' | 'anthropic';

/**
 * Provider-agnostic AI client with:
 *  - Strategy-pattern provider selection (AI_PROVIDER env var)
 *  - Singleton lifecycle
 *  - Real-time event emission (AIEventBus)
 *  - Cost tracking (CostTracker)
 *  - Optional LangSmith tracing
 *  - Zod-validated JSON completions (completeJson)
 *
 * AI_PROVIDER=local      → Ollama  (free, local — default)
 * AI_PROVIDER=anthropic  → Claude  (paid, requires ANTHROPIC_API_KEY)
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

  /** Reset singleton — useful after provider config changes from Admin panel. */
  static reset(): void {
    AIClient.instance = null;
  }

  get providerName(): string { return this.provider.name; }

  // ── Core completion ─────────────────────────────────────────────────────────

  async complete(params: CompleteParams): Promise<string> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'general';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    try {
      const result = await this.provider.complete(params);

      const latencyMs = Date.now() - startedAt;
      const cost = costTracker.record(this.provider.name, 0, 0);
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: cost, success: true,
      });

      logger.debug(`[AI] ${op} completed in ${latencyMs}ms (${this.provider.name})`);
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: (err as Error).message,
      });
      throw err;
    }
  }

  async completeWithVision(params: VisionParams): Promise<string> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'vision';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    try {
      const result = await this.provider.completeWithVision(params);
      const latencyMs = Date.now() - startedAt;
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: true,
      });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Structured JSON completion — response is parsed and validated against a Zod schema.
   * Providers use their native JSON mode where available (Ollama format:json, Anthropic instruction).
   */
  async completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'general';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    try {
      const result = await this.provider.completeJson(params, schema);
      const latencyMs = Date.now() - startedAt;
      const cost = costTracker.record(this.provider.name, 0, 0);
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: cost, success: true,
      });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: (err as Error).message,
      });
      throw err;
    }
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  private static createProvider(): IAIProvider {
    const name = (process.env.AI_PROVIDER ?? 'local') as ProviderName;
    switch (name) {
      case 'anthropic': return new AnthropicProvider();
      case 'local':
      default:          return new OllamaProvider();
    }
  }
}
