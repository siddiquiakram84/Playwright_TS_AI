/**
 * Index the local codebase into the vector store.
 *
 * Usage:
 *   npm run ai:index
 *
 * What happens:
 *   1. Walks aut/tests/, core/ai/agents/, core/pages/, core/fixtures.ts
 *   2. Splits each file into overlapping 800-char chunks
 *   3. Embeds each chunk via Ollama nomic-embed-text (free, local)
 *   4. Stores embeddings in core/ai/memory/.index/codebase.json
 *
 * After indexing, test generation (npm run ai:generate-tests) will
 * automatically retrieve relevant existing specs/POMs as context —
 * this is the RAG (Retrieval-Augmented Generation) pattern.
 *
 * Prerequisites:
 *   ollama pull nomic-embed-text   (274 MB, one-time download)
 *   ollama serve                   (if not already running)
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';
import * as fs     from 'fs/promises';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { embeddingProvider }  from '../ai/memory/EmbeddingProvider';
import { getStore, storePath } from '../ai/memory/VectorStore';
import { indexCodebase }      from '../ai/memory/CodeIndexer';
import { logger }             from '../utils/logger';

const COLLECTION = 'codebase';

async function main(): Promise<void> {
  console.log('\n\x1b[35m🧠 Codebase Indexer — RAG Pipeline\x1b[0m');
  console.log('   Embedding model : ' + (process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'));
  console.log('   Ollama URL       : ' + (process.env.OLLAMA_BASE_URL   ?? 'http://localhost:11434'));
  console.log('');

  const store     = getStore(COLLECTION);
  const indexFile = storePath(COLLECTION);

  // Load existing index so re-runs don't reset history
  try {
    const raw  = await fs.readFile(indexFile, 'utf8');
    const prev = JSON.parse(raw) as unknown[];
    console.log(`\x1b[33m   Previous index: ${prev.length} chunks — will merge\x1b[0m`);
    store.add(prev as Parameters<typeof store.add>[0]);
  } catch {
    console.log('   No previous index — creating fresh');
  }

  const start = Date.now();

  let stats: Awaited<ReturnType<typeof indexCodebase>>;
  try {
    stats = await indexCodebase(store, embeddingProvider);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('Cannot reach Ollama')) {
      console.error('\n\x1b[31m✗ Ollama is not running.\x1b[0m');
      console.error('  Start it:    ollama serve');
      console.error('  Pull model:  ollama pull nomic-embed-text\n');
    } else {
      console.error('\n\x1b[31m✗ Indexing failed:\x1b[0m', msg);
    }
    process.exit(1);
  }

  await store.save(indexFile);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\x1b[32m✓ Indexed ${stats.files} files → ${stats.chunks} chunks in ${elapsed}s\x1b[0m`);
  console.log(`  Saved to: ${path.relative(process.cwd(), indexFile)}`);
  console.log('\n  Test generation will now use RAG context automatically.');
  console.log('  Run: npm run ai:generate-tests -- --nl "your test description"\n');
}

main().catch(err => { logger.error(err); process.exit(1); });
