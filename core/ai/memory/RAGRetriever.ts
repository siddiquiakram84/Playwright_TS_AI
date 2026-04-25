/**
 * RAGRetriever — Retrieval-Augmented Generation for test context.
 *
 * Flow:
 *   1. Embed the query (natural language or user story)
 *   2. Query VectorStore for top-k semantically similar code chunks
 *   3. Format results as a context block injected into the LLM system prompt
 *
 * This lets the LLM "see" relevant existing tests, POMs, and fixtures before
 * writing new code — dramatically reducing hallucinated selectors/imports and
 * improving consistency with the existing codebase.
 *
 * Usage:
 *   const ctx = await ragRetriever.retrieve('user login with invalid credentials');
 *   // ctx is a formatted string — inject into system prompt
 */

import { logger }             from '../../utils/logger';
import { EmbeddingProvider }  from './EmbeddingProvider';
import { VectorStore, QueryResult } from './VectorStore';

export interface RetrievalResult {
  context:  string;   // formatted string ready for system prompt injection
  sources:  string[]; // file paths that contributed context
  chunks:   number;   // how many chunks were retrieved
}

export class RAGRetriever {
  constructor(
    private readonly store:   VectorStore,
    private readonly embedder: EmbeddingProvider,
  ) {}

  /**
   * Retrieve relevant code context for the given query.
   * Returns empty context (gracefully) if embeddings fail or store is empty.
   */
  async retrieve(query: string, topK = 6): Promise<RetrievalResult> {
    if (this.store.size === 0) {
      logger.debug('[RAG] Vector store is empty — run `npm run ai:index` to enable RAG');
      return { context: '', sources: [], chunks: 0 };
    }

    let queryVec: number[];
    try {
      [queryVec] = await this.embedder.embed([query]);
    } catch (err) {
      logger.warn(`[RAG] Embedding failed — continuing without context: ${(err as Error).message}`);
      return { context: '', sources: [], chunks: 0 };
    }

    const results = this.store.query(queryVec, topK);
    if (results.length === 0) {
      logger.debug('[RAG] No relevant context found for query');
      return { context: '', sources: [], chunks: 0 };
    }

    const sources = [...new Set(results.map(r => r.metadata['file'] ?? ''))].filter(Boolean);
    logger.debug(`[RAG] Retrieved ${results.length} chunks from: ${sources.join(', ')}`);

    return {
      context: formatContext(results),
      sources,
      chunks: results.length,
    };
  }

  /** Retrieve context and format it as a ready-to-use system prompt addendum. */
  async getContextBlock(query: string, topK = 6): Promise<string> {
    const result = await this.retrieve(query, topK);
    if (!result.context) return '';
    return (
      `\n\n════ EXISTING CODEBASE CONTEXT (retrieved from ${result.chunks} relevant chunks) ════\n` +
      `The following code is from the existing test suite. Mirror its patterns:\n\n` +
      result.context +
      `\n════ END CODEBASE CONTEXT ════\n`
    );
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function formatContext(results: QueryResult[]): string {
  return results
    .map(r => {
      const file  = r.metadata['file']  ?? 'unknown';
      const type  = r.metadata['type']  ?? 'source';
      const score = r.score.toFixed(2);
      return `// [${type}] ${file}  (relevance: ${score})\n${r.content}`;
    })
    .join('\n\n---\n\n');
}
