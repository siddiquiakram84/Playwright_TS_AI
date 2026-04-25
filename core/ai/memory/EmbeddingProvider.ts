/**
 * EmbeddingProvider — converts text into dense vector representations.
 *
 * Default: Ollama /api/embed with nomic-embed-text (768 dims, free, local).
 * The model is small (~274 MB) and purpose-built for retrieval tasks.
 *
 * Pull once:  ollama pull nomic-embed-text
 *
 * When Ollama is unreachable the provider throws — CodeIndexer and
 * RAGRetriever both have try/catch guards so RAG degrades gracefully
 * (tests still run; they just don't get context injection).
 */

import { logger } from '../../utils/logger';

export interface EmbeddingProvider {
  /** Batch-embed texts. Returns one float[] per input string. */
  embed(texts: string[]): Promise<number[][]>;
  /** Dimensionality of the embedding vectors. */
  readonly dims: number;
}

// ── Ollama nomic-embed-text ───────────────────────────────────────────────────

class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly model:   string;
  private readonly baseUrl: string;
  private _dims = 768;

  constructor() {
    this.model   = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';
    this.baseUrl = process.env.OLLAMA_BASE_URL    ?? 'http://localhost:11434';
  }

  get dims(): number { return this._dims; }

  async embed(texts: string[]): Promise<number[][]> {
    logger.debug(`[Embeddings] Embedding ${texts.length} chunk(s) via ${this.model}`);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/embed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: this.model, input: texts }),
        signal:  AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new Error(
        `[Embeddings] Cannot reach Ollama at ${this.baseUrl}.\n` +
        `Run: ollama pull ${this.model}  (then ollama serve)\n` +
        `Original: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[Embeddings] HTTP ${res.status}: ${body}`);
    }

    const data = await res.json() as { embeddings?: number[][]; embedding?: number[][] };
    // Ollama v0.3+ returns 'embeddings' (array), older returns 'embedding'
    const vecs = data.embeddings ?? data.embedding ?? [];
    if (vecs[0]) this._dims = vecs[0].length;
    return vecs;
  }
}

export const embeddingProvider: EmbeddingProvider = new OllamaEmbeddingProvider();
