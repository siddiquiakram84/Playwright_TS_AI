/**
 * Vector Memory — RAG pipeline exports.
 *
 * Quick-start:
 *   import { ragRetriever, ensureIndexLoaded } from '../memory';
 *   await ensureIndexLoaded();
 *   const ctx = await ragRetriever.getContextBlock('test user login');
 */

import * as path from 'path';
import { embeddingProvider }         from './EmbeddingProvider';
import { getStore, storePath }       from './VectorStore';
import { RAGRetriever }              from './RAGRetriever';
import { logger }                    from '../../utils/logger';

export { embeddingProvider }         from './EmbeddingProvider';
export { VectorStore, getStore }     from './VectorStore';
export { indexCodebase }             from './CodeIndexer';
export { RAGRetriever }              from './RAGRetriever';

// ── Default collection: codebase ─────────────────────────────────────────────

const CODEBASE_COLLECTION = 'codebase';
const codebaseStore = getStore(CODEBASE_COLLECTION);

export const ragRetriever = new RAGRetriever(codebaseStore, embeddingProvider);

let indexLoaded = false;

/**
 * Load the persisted vector index from disk (if it exists).
 * Call this once before using ragRetriever — it's a no-op if already loaded.
 */
export async function ensureIndexLoaded(): Promise<void> {
  if (indexLoaded) return;
  const loaded = await codebaseStore.load(storePath(CODEBASE_COLLECTION));
  indexLoaded = true;
  if (loaded) {
    logger.debug(`[RAG] Loaded ${codebaseStore.size} vectors from disk`);
  } else {
    logger.debug('[RAG] No index on disk — run `npm run ai:index` to enable RAG');
  }
}
