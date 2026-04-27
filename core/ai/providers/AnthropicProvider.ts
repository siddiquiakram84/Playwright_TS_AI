import Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';
import { IAIProvider, CompleteParams, VisionParams, TokenUsage } from './IAIProvider';
import { logger } from '../../utils/logger';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export class AnthropicProvider implements IAIProvider {
  readonly name  = 'anthropic';
  readonly model = ANTHROPIC_MODEL;

  lastUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, cacheWriteTokens: 0 };

  private readonly client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('[AnthropicProvider] ANTHROPIC_API_KEY is not set in your .env file.');
    }
    this.client = new Anthropic({ apiKey });
    logger.info(`[AnthropicProvider] Initialised (model: ${ANTHROPIC_MODEL})`);
  }

  /**
   * Text completion with prompt caching on the system prompt.
   * Caching activates at ≥ 2048 tokens for claude-sonnet-4-6.
   */
  async complete(params: CompleteParams): Promise<string> {
    const systemContent = params.jsonMode
      ? params.systemPrompt + '\n\nCRITICAL: Return ONLY valid JSON — no markdown, no code fences, no prose.'
      : params.systemPrompt;

    const response = await this.client.messages.create({
      model:      ANTHROPIC_MODEL,
      max_tokens: params.maxTokens ?? 4096,
      system: [
        {
          type:          'text',
          text:          systemContent,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: params.userMessage }],
    });

    this.lastUsage = {
      inputTokens:      response.usage.input_tokens,
      outputTokens:     response.usage.output_tokens,
      cacheHitTokens:   response.usage.cache_read_input_tokens  ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    if (this.lastUsage.cacheHitTokens   > 0) logger.debug(`[Anthropic] Cache hit   — ${this.lastUsage.cacheHitTokens} tokens saved`);
    if (this.lastUsage.cacheWriteTokens > 0) logger.debug(`[Anthropic] Cache write — ${this.lastUsage.cacheWriteTokens} tokens stored`);

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : '';
  }

  /** Vision completion — sends base64 images in the user message. */
  async completeWithVision(params: VisionParams): Promise<string> {
    const imageBlocks = params.images.map(img => ({
      type:   'image' as const,
      source: {
        type:       'base64' as const,
        media_type: img.mediaType,
        data:       img.base64,
      },
    }));

    const response = await this.client.messages.create({
      model:      ANTHROPIC_MODEL,
      max_tokens: params.maxTokens ?? 4096,
      system: [
        {
          type:          'text',
          text:          params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role:    'user',
          content: [...imageBlocks, { type: 'text', text: params.userMessage }],
        },
      ],
    });

    this.lastUsage = {
      inputTokens:      response.usage.input_tokens,
      outputTokens:     response.usage.output_tokens,
      cacheHitTokens:   response.usage.cache_read_input_tokens  ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    };

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : '';
  }

  /** JSON completion with Zod validation; retries once on parse failure. */
  async completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T> {
    const jsonParams: CompleteParams = { ...params, jsonMode: true };
    const raw = await this.complete(jsonParams);
    try {
      return this.parseAndValidate(raw, schema);
    } catch {
      // Retry with an explicit repair instruction
      logger.warn('[Anthropic] JSON parse failed — retrying with repair prompt');
      const repairRaw = await this.complete({
        ...jsonParams,
        userMessage: `${params.userMessage}\n\nYour previous response was not valid JSON. Return ONLY the raw JSON object or array.`,
      });
      return this.parseAndValidate(repairRaw, schema);
    }
  }

  private parseAndValidate<T>(raw: string, schema: ZodSchema<T>): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      const match = raw.match(/(\{[\s\S]+\}|\[[\s\S]+\])/);
      if (!match) throw new Error(`[AnthropicProvider] No JSON in response: ${raw.substring(0, 200)}`);
      parsed = JSON.parse(match[0]);
    }
    return schema.parse(parsed);
  }
}
