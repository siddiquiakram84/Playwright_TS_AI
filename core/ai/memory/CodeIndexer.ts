/**
 * CodeIndexer — feeds the local codebase into the vector store.
 *
 * What it indexes:
 *   aut/tests/       → existing test specs (type: "spec")
 *   core/ai/agents/  → agent implementations (type: "agent")
 *   core/fixtures.ts → available fixtures (type: "fixture")
 *   core/pages/      → Page Object Models (type: "pom")
 *
 * Chunking strategy:
 *   Files are split into ~800-char overlapping chunks so each embedding
 *   represents a coherent unit of code, not an arbitrary byte boundary.
 *   Chunk overlap (100 chars) prevents context loss at boundaries.
 *
 * When to re-index:
 *   Run `npm run ai:index` whenever you add new specs, POMs, or fixtures.
 *   The indexer deduplicates by {file}:{chunkIndex} so re-runs are safe.
 */

import * as fsSync from 'fs';
import * as fs     from 'fs/promises';
import * as path   from 'path';
import * as crypto from 'crypto';

import { EmbeddingProvider }       from './EmbeddingProvider';
import { VectorStore, VectorDoc }  from './VectorStore';
import { logger }                  from '../../utils/logger';

// ── Configuration ─────────────────────────────────────────────────────────────

const CHUNK_SIZE    = 800;  // characters per chunk
const CHUNK_OVERLAP = 100;  // character overlap between consecutive chunks
const BATCH_SIZE    = 20;   // embed this many chunks per Ollama API call

// Directories to walk (relative to project root)
const INDEX_DIRS = ['aut/tests', 'core/ai/agents', 'core/pages', 'core/fixtures'];
// Individual files to always index
const INDEX_FILES = ['core/fixtures.ts'];
const INDEX_EXT   = '.ts';

// Paths containing any of these strings are skipped
const SKIP_FRAGMENTS = [
  'node_modules', '.git', 'dist', 'dashboard', '.d.ts',
  'memory/.index', 'healed-selectors',
];

// Maps directory fragments to semantic type labels
const TYPE_MAP: Array<[fragment: string, type: string]> = [
  ['aut/tests',     'spec'],
  ['core/pages',    'pom'],
  ['core/fixtures', 'fixture'],
  ['core/ai/agents','agent'],
];

function fileType(filePath: string): string {
  for (const [frag, type] of TYPE_MAP) {
    if (filePath.includes(frag)) return type;
  }
  return 'source';
}

// ── Chunking ──────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk); // skip near-empty tails
    if (end >= text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ── File discovery ────────────────────────────────────────────────────────────

async function collectFiles(root: string, dirs: string[], extra: string[]): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try { entries = await fs.readdir(dir); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (SKIP_FRAGMENTS.some(s => full.includes(s))) continue;
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        await walk(full);
      } else if (path.extname(full) === INDEX_EXT) {
        files.push(full);
      }
    }
  }

  for (const d of dirs) {
    const abs = path.resolve(root, d);
    if (fsSync.existsSync(abs)) await walk(abs);
  }

  for (const f of extra) {
    const abs = path.resolve(root, f);
    if (fsSync.existsSync(abs)) files.push(abs);
  }

  return [...new Set(files)]; // deduplicate
}

// ── Main indexer ──────────────────────────────────────────────────────────────

export interface IndexStats {
  files:  number;
  chunks: number;
  skipped: number;
}

export async function indexCodebase(
  store:   VectorStore,
  embedder: EmbeddingProvider,
  root     = process.cwd(),
): Promise<IndexStats> {
  const files = await collectFiles(root, INDEX_DIRS, INDEX_FILES);
  logger.info(`[CodeIndexer] Found ${files.length} TypeScript files to index`);

  // Build all (text, metadata) pairs first, then batch-embed
  const pending: Array<{ id: string; content: string; metadata: Record<string, string> }> = [];

  for (const file of files) {
    const rel      = path.relative(root, file).replace(/\\/g, '/');
    const text     = await fs.readFile(file, 'utf8').catch(() => '');
    if (!text.trim()) continue;
    const chunks   = chunkText(text);
    const type     = fileType(rel);

    for (let i = 0; i < chunks.length; i++) {
      const id = crypto.createHash('md5').update(`${rel}:${i}:${chunks[i].slice(0, 40)}`).digest('hex');
      pending.push({ id, content: chunks[i], metadata: { file: rel, chunk: String(i), type } });
    }
  }

  logger.info(`[CodeIndexer] Embedding ${pending.length} chunks in batches of ${BATCH_SIZE}…`);

  let embedded = 0;
  const docs: VectorDoc[] = [];

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const vectors = await embedder.embed(batch.map(b => b.content));
    for (let j = 0; j < batch.length; j++) {
      docs.push({ ...batch[j], embedding: vectors[j] ?? [] });
    }
    embedded += batch.length;
    logger.debug(`[CodeIndexer] ${embedded}/${pending.length} chunks embedded`);
  }

  store.add(docs);
  logger.info(`[CodeIndexer] ✓ Indexed ${docs.length} chunks from ${files.length} files`);

  return { files: files.length, chunks: docs.length, skipped: pending.length - docs.length };
}
