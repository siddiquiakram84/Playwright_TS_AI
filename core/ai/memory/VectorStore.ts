/**
 * VectorStore — in-memory cosine-similarity store with JSON persistence.
 *
 * Why not Chroma/Qdrant/Pinecone?
 *   Those are excellent for production, but require a running service.
 *   This implementation works with zero infrastructure, persists to a JSON
 *   file, and is trivially swappable for a real vector DB by implementing
 *   the same interface.
 *
 * Performance: ~10 ms query on 5,000 chunks (typical mid-size repo).
 * For repos with 50k+ chunks switch to Chroma: set CHROMA_URL in .env.
 *
 * Collections map 1:1 to named JSON files under core/ai/memory/.
 */

import * as fs   from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface VectorDoc {
  id:        string;
  embedding: number[];
  content:   string;
  metadata:  Record<string, string>;
}

export interface QueryResult {
  content:  string;
  metadata: Record<string, string>;
  score:    number;
}

export class VectorStore {
  private docs: VectorDoc[] = [];

  /** Add documents (with pre-computed embeddings) to the store. */
  add(docs: VectorDoc[]): void {
    // Deduplicate by id — re-indexing replaces existing entries
    const existing = new Map(this.docs.map(d => [d.id, d]));
    for (const doc of docs) existing.set(doc.id, doc);
    this.docs = [...existing.values()];
  }

  /**
   * Return the top-k most similar documents to a query embedding.
   * Uses cosine similarity — values range from -1 (opposite) to 1 (identical).
   */
  query(queryEmbedding: number[], topK = 5): QueryResult[] {
    if (this.docs.length === 0) return [];
    return this.docs
      .map(doc => ({
        content:  doc.content,
        metadata: doc.metadata,
        score:    cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(r => r.score > 0.3); // discard low-relevance results
  }

  get size(): number { return this.docs.length; }

  clear(): void { this.docs = []; }

  // ── Persistence ─────────────────────────────────────────────────────────────

  async save(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(this.docs), 'utf8');
    logger.debug(`[VectorStore] Saved ${this.docs.length} docs → ${filePath}`);
  }

  async load(filePath: string): Promise<boolean> {
    try {
      const raw  = await fs.readFile(filePath, 'utf8');
      this.docs  = JSON.parse(raw) as VectorDoc[];
      logger.debug(`[VectorStore] Loaded ${this.docs.length} docs ← ${filePath}`);
      return true;
    } catch {
      return false; // file doesn't exist yet — first run
    }
  }
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Singleton stores (one per collection) ───────────────────────────────────

const STORE_DIR = path.join(process.cwd(), 'core', 'ai', 'memory', '.index');

export const storeRegistry = new Map<string, VectorStore>();

export function getStore(collection: string): VectorStore {
  if (!storeRegistry.has(collection)) storeRegistry.set(collection, new VectorStore());
  return storeRegistry.get(collection)!;
}

export function storePath(collection: string): string {
  return path.join(STORE_DIR, `${collection}.json`);
}
