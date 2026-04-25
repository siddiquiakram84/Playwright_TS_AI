import type { ZodSchema } from 'zod';
import { IAIProvider, CompleteParams, VisionParams, TokenUsage } from './IAIProvider';
import { logger } from '../../utils/logger';

interface OllamaChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaChatResponse {
  model:              string;
  message:            { role: string; content: string };
  done:               boolean;
  prompt_eval_count?: number; // input tokens (may be absent on cache hit)
  eval_count?:        number; // output tokens
}

export class OllamaProvider implements IAIProvider {
  readonly name = 'ollama';

  lastUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };

  private readonly baseUrl:      string;
  private readonly textModel:    string;
  private readonly visionModel:  string;

  constructor() {
    this.baseUrl     = process.env.OLLAMA_BASE_URL    ?? 'http://localhost:11434';
    this.textModel   = process.env.OLLAMA_MODEL       ?? 'llama3.2';
    this.visionModel = process.env.OLLAMA_VISION_MODEL ?? 'llava';
  }

  async complete(params: CompleteParams): Promise<string> {
    const messages: OllamaChatMessage[] = [
      { role: 'system', content: params.systemPrompt },
      { role: 'user',   content: params.userMessage  },
    ];
    return this.chat(this.textModel, messages, params.maxTokens, params.jsonMode);
  }

  async completeWithVision(params: VisionParams): Promise<string> {
    const images = params.images.map(img => img.base64);
    const messages: OllamaChatMessage[] = [
      { role: 'system', content: params.systemPrompt },
      { role: 'user',   content: params.userMessage, images },
    ];
    const textMessages: OllamaChatMessage[] = [
      { role: 'system', content: params.systemPrompt },
      {
        role:    'user',
        content: `[No vision model available — reasoning from context only]\n\n${params.userMessage}`,
      },
    ];
    try {
      return await this.chat(this.visionModel, messages, params.maxTokens);
    } catch (err) {
      logger.warn(
        `[Ollama] Vision call failed (model=${this.visionModel}) — falling back to text-only.\n` +
        `Error: ${(err as Error).message}`,
      );
    }
    try {
      return await this.chat(this.textModel, textMessages, params.maxTokens);
    } catch (err) {
      // Both vision and text fallback failed (Ollama unresponsive — model loading OOM).
      // Return a sentinel so callers can degrade gracefully instead of timing out.
      logger.warn(`[Ollama] Text fallback also failed — returning offline sentinel`);
      return '[OLLAMA_UNAVAILABLE]';
    }
  }

  async completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T> {
    let lastErr: Error | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const extraInstruction = attempt === 1
        ? '\n\nCRITICAL: Return ONLY valid JSON — no markdown, no code fences, no prose.'
        : '\n\nCRITICAL: Return ONLY valid JSON — no markdown, no code fences, no prose.' +
          '\nPrevious attempt returned wrong structure. Return the EXACT JSON shape requested — no wrapper objects, no extra keys.';
      const jsonParams: CompleteParams = {
        ...params,
        systemPrompt: params.systemPrompt + extraInstruction,
        jsonMode: true,
      };
      try {
        const raw = await this.complete(jsonParams);
        return this.parseAndValidate(raw, schema);
      } catch (err) {
        lastErr = err as Error;
        const isSchemaErr  = lastErr.message.includes('[OllamaProvider]');
        // "fetch failed" = ECONNREFUSED — Ollama is loading a model or restarting.
        // Brief wait and retry; do NOT retry AbortSignal timeouts ("aborted due to timeout").
        const isConnErr    = lastErr.message.includes('[Ollama] Cannot reach') &&
                             lastErr.message.includes('fetch failed');
        if (attempt < 3 && (isSchemaErr || isConnErr)) {
          if (isConnErr) {
            logger.warn(`[OllamaProvider] Ollama unreachable (attempt ${attempt}) — waiting 30s before retry…`);
            await new Promise(r => setTimeout(r, 30_000));
          } else {
            logger.warn(`[OllamaProvider] JSON attempt ${attempt} failed validation — retrying: ${lastErr.message.substring(0, 120)}`);
          }
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr!;
  }

  private async chat(
    model:     string,
    messages:  OllamaChatMessage[],
    maxTokens?: number,
    jsonMode?:  boolean,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;
    logger.debug(`[Ollama] POST ${url} model=${model}${jsonMode ? ' format=json' : ''}`);

    // For vision models, cap the fetch at 90s — loading a vision model into RAM
    // can make Ollama temporarily unresponsive; fail fast so the fallback can run.
    const isVision = model === this.visionModel;
    const fetchTimeoutMs = isVision ? 90_000 : 600_000;

    let response: Response;
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: jsonMode ? 'json' : undefined,
          options: maxTokens ? { num_predict: maxTokens } : {},
        }),
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
    } catch (err) {
      throw new Error(
        `[Ollama] Cannot reach Ollama at ${this.baseUrl}. ` +
        `Ensure Ollama is running: https://ollama.com/download\n` +
        `Then pull a model:  ollama pull ${model}\n` +
        `Original error: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[Ollama] HTTP ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    // Ollama reports token counts per call — capture them on every chat()
    this.lastUsage = {
      inputTokens:    data.prompt_eval_count ?? 0,
      outputTokens:   data.eval_count        ?? 0,
      cacheHitTokens: 0,
    };
    return data.message?.content ?? '';
  }

  private parseAndValidate<T>(raw: string, schema: ZodSchema<T>): T {
    const cleaned = raw.trim();
    let parsed: unknown;

    // 1. Direct parse
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // 2. Extract first JSON block from prose — prefer array over object if both appear
      const arrIdx = cleaned.indexOf('[');
      const objIdx = cleaned.indexOf('{');
      const pattern = (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx))
        ? /(\[[\s\S]+\])/
        : /(\{[\s\S]+\})/;
      const match = cleaned.match(pattern);
      if (!match) {
        throw new Error(`[OllamaProvider] No JSON found in response: ${cleaned.substring(0, 200)}`);
      }
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error(`[OllamaProvider] Invalid JSON extracted from response: ${match[1].substring(0, 200)}`);
      }
    }

    // 3. Try schema directly
    const direct = schema.safeParse(parsed);
    if (direct.success) return direct.data;

    // 4. Mistral often wraps results in a single-key object — unwrap and retry
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const unwrapped = schema.safeParse(obj[key]);
        if (unwrapped.success) {
          logger.debug(`[OllamaProvider] Unwrapped response from key "${key}"`);
          return unwrapped.data;
        }
      }
      // 4b. Schema may expect an array — mistral sometimes returns a single item
      const asArray = schema.safeParse([parsed]);
      if (asArray.success) {
        logger.debug('[OllamaProvider] Wrapped single object into array for schema match');
        return asArray.data;
      }
    }

    // 5. Surface a clear Zod error
    const result = schema.safeParse(parsed);
    const zodMsg = !result.success
      ? result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      : '';
    throw new Error(`[OllamaProvider] Schema validation failed — ${zodMsg}\nRaw (truncated): ${cleaned.substring(0, 300)}`);
  }
}
