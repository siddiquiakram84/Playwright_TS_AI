import type { ZodSchema } from 'zod';

export interface AIImage {
  base64:    string;
  mediaType: 'image/png' | 'image/jpeg';
}

export interface CompleteParams {
  systemPrompt: string;
  userMessage:  string;
  maxTokens?:   number;
  /** When true, providers should use their native JSON-output mode. */
  jsonMode?:    boolean;
  /** Metadata for event bus / tracing — e.g. which operation triggered this call. */
  operation?:   string;
}

export interface VisionParams extends CompleteParams {
  images: AIImage[];
}

export interface IAIProvider {
  readonly name: string;
  complete(params: CompleteParams): Promise<string>;
  completeWithVision(params: VisionParams): Promise<string>;
  /** Parse + validate AI response against a Zod schema. Providers can override with native JSON mode. */
  completeJson<T>(params: CompleteParams, schema: ZodSchema<T>): Promise<T>;
}
