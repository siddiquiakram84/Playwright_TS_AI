import * as fs     from 'fs/promises';
import * as crypto from 'crypto';
import * as path   from 'path';

const CACHE_PATH  = path.join(process.cwd(), 'core', 'ai', 'response-cache.json');
const MAX_ENTRIES = 100;

// TTL per operation in ms. 0 = never cache.
const OP_TTL: Record<string, number> = {
  healing:    24 * 3600_000, // 24 h — selector answers are stable
  general:         3600_000, // 1 h
  vision:               0,  // images are always unique
  testgen:              0,  // generation should always be fresh
  planning:             0,
  writing:              0,
  validating:           0,
};
const DEFAULT_TTL = 3600_000; // 1 h for unknown operations

interface CacheEntry {
  value:     unknown;
  operation: string;
  expiresAt: number;
  hits:      number;
}

interface CacheStore {
  entries: Record<string, CacheEntry>;
  stats:   { hits: number; misses: number };
}

export class AIResponseCache {
  private static _instance: AIResponseCache;
  private store: CacheStore = { entries: {}, stats: { hits: 0, misses: 0 } };
  private dirty = false;
  private loaded = false;

  static getInstance(): AIResponseCache {
    if (!this._instance) this._instance = new AIResponseCache();
    return this._instance;
  }

  static keyFor(providerName: string, systemPrompt: string, userMessage: string): string {
    return crypto
      .createHash('sha256')
      .update(`${providerName}\x00${systemPrompt}\x00${userMessage}`)
      .digest('hex');
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(CACHE_PATH, 'utf8');
      this.store = JSON.parse(raw) as CacheStore;
    } catch { /* first run — start empty */ }
  }

  private async persist(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
      // Prune expired before writing to keep file small
      const now = Date.now();
      for (const k of Object.keys(this.store.entries)) {
        if (this.store.entries[k].expiresAt < now) delete this.store.entries[k];
      }
      await fs.writeFile(CACHE_PATH, JSON.stringify(this.store, null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }

  get<T>(key: string, operation: string): T | null {
    const ttl = OP_TTL[operation] ?? DEFAULT_TTL;
    if (ttl === 0) { this.store.stats.misses++; return null; }

    const entry = this.store.entries[key];
    if (!entry) { this.store.stats.misses++; return null; }

    if (Date.now() > entry.expiresAt) {
      delete this.store.entries[key];
      this.dirty = true;
      void this.persist();
      this.store.stats.misses++;
      return null;
    }

    entry.hits++;
    this.store.stats.hits++;
    return entry.value as T;
  }

  set(key: string, operation: string, value: unknown): void {
    const ttl = OP_TTL[operation] ?? DEFAULT_TTL;
    if (ttl === 0) return;

    // Evict: expired first, then oldest (by insertion order) if still full
    const keys = Object.keys(this.store.entries);
    if (keys.length >= MAX_ENTRIES) {
      const now = Date.now();
      const expiredKey = keys.find(k => this.store.entries[k].expiresAt < now);
      delete this.store.entries[expiredKey ?? keys[0]];
    }

    this.store.entries[key] = { value, operation, expiresAt: Date.now() + ttl, hits: 0 };
    this.dirty = true;
    void this.persist();
  }

  clear(operation?: string): void {
    if (operation) {
      for (const k of Object.keys(this.store.entries)) {
        if (this.store.entries[k].operation === operation) delete this.store.entries[k];
      }
    } else {
      this.store.entries = {};
    }
    this.dirty = true;
    void this.persist();
  }

  stats() {
    const now  = Date.now();
    const live = Object.values(this.store.entries).filter(e => e.expiresAt > now).length;
    const { hits, misses } = this.store.stats;
    const total = hits + misses;
    return {
      size:    live,
      hits,
      misses,
      hitRate: total > 0 ? Math.round((hits / total) * 1000) / 10 : 0,
    };
  }
}

export const aiResponseCache = AIResponseCache.getInstance();
