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
 * Provider-agnostic AI client:
 *  - Strategy-pattern provider selection (AI_PROVIDER env var)
 *  - Singleton lifecycle
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

  // ── Text completion ──────────────────────────────────────────────────────────

  async complete(params: CompleteParams): Promise<string> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'general';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    langSmithTracer.startRun(id, {
      name:    op,
      inputs: {
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user',   content: params.userMessage  },
        ],
        provider: this.provider.name,
      },
      tags: [this.provider.name, op],
    });

    try {
      const result = await this.provider.complete(params);

      const latencyMs = Date.now() - startedAt;
      const { inputTokens, outputTokens, cacheHitTokens } = this.provider.lastUsage;
      const cost = costTracker.record(this.provider.name, inputTokens, outputTokens, cacheHitTokens);

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens, outputTokens, cacheHitTokens,
        costUsd: cost, success: true,
      });

      langSmithTracer.endRun(id, { output: result, usage: { inputTokens, outputTokens, cacheHitTokens } });

      logger.debug(`[AI] ${op} in ${latencyMs}ms (${this.provider.name}) in=${inputTokens} out=${outputTokens} cache=${cacheHitTokens}`);
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const msg = (err as Error).message;

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: msg,
      });

      langSmithTracer.endRun(id, { output: '', error: msg });
      throw err;
    }
  }

  // ── Vision completion ────────────────────────────────────────────────────────

  async completeWithVision(params: VisionParams): Promise<string> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'vision';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    langSmithTracer.startRun(id, {
      name:    op,
      inputs: {
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user',   content: `[vision] ${params.userMessage}` },
        ],
        provider: this.provider.name,
      },
      tags: [this.provider.name, op, 'vision'],
    });

    try {
      const result = await this.provider.completeWithVision(params);
      const latencyMs = Date.now() - startedAt;
      const { inputTokens, outputTokens, cacheHitTokens } = this.provider.lastUsage;
      const cost = costTracker.record(this.provider.name, inputTokens, outputTokens, cacheHitTokens);

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens, outputTokens, cacheHitTokens,
        costUsd: cost, success: true,
      });

      langSmithTracer.endRun(id, { output: result, usage: { inputTokens, outputTokens, cacheHitTokens } });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const msg = (err as Error).message;

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: msg,
      });

      langSmithTracer.endRun(id, { output: '', error: msg });
      throw err;
    }
  }

  // ── JSON completion ──────────────────────────────────────────────────────────

  async completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T> {
    const id        = aiEventBus.newCallId();
    const startedAt = Date.now();
    const op        = params.operation ?? 'general';

    aiEventBus.emitLLMStart({
      id, provider: this.provider.name, operation: op, timestamp: startedAt,
      systemPromptLength: params.systemPrompt.length,
      userMessageLength:  params.userMessage.length,
    });

    langSmithTracer.startRun(id, {
      name:    op,
      inputs: {
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user',   content: params.userMessage  },
        ],
        provider: this.provider.name,
      },
      tags: [this.provider.name, op, 'json'],
    });

    try {
      const result = await this.provider.completeJson(params, schema);
      const latencyMs = Date.now() - startedAt;
      const { inputTokens, outputTokens, cacheHitTokens } = this.provider.lastUsage;
      const cost = costTracker.record(this.provider.name, inputTokens, outputTokens, cacheHitTokens);

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens, outputTokens, cacheHitTokens,
        costUsd: cost, success: true,
      });

      langSmithTracer.endRun(id, {
        output: JSON.stringify(result),
        usage: { inputTokens, outputTokens, cacheHitTokens },
      });

      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const msg = (err as Error).message;

      aiEventBus.emitLLMEnd({
        id, provider: this.provider.name, operation: op, timestamp: Date.now(),
        latencyMs, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0,
        costUsd: 0, success: false, error: msg,
      });

      langSmithTracer.endRun(id, { output: '', error: msg });
      throw err;
    }
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
