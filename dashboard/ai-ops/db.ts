/**
 * AI Ops Persistence Layer — SQLite via better-sqlite3.
 *
 * Stores all LLM calls, visual test results, healing events, and test-gen
 * sessions so historical data survives server restarts and can be queried
 * for trend analysis, cost auditing, and debugging.
 *
 * DB location: dashboard/ai-ops/aiops.db (excluded from .gitignore)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs   from 'fs';

const DB_PATH = path.resolve(__dirname, 'aiops.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // write-ahead log — concurrent reads during writes
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_calls (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id      TEXT    NOT NULL,
      provider     TEXT    NOT NULL,
      operation    TEXT    NOT NULL,
      latency_ms   INTEGER,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_tokens INTEGER DEFAULT 0,
      cost_usd     REAL    DEFAULT 0,
      success      INTEGER DEFAULT 1,
      error        TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON llm_calls(created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_provider ON llm_calls(provider);

    CREATE TABLE IF NOT EXISTS visual_tests (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      page_name    TEXT    NOT NULL,
      status       TEXT    NOT NULL,   -- 'pass' | 'fail'
      diff_count   INTEGER DEFAULT 0,
      diff_pct     REAL    DEFAULT 0,
      provider     TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );

    CREATE TABLE IF NOT EXISTS healing_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      original_sel TEXT    NOT NULL,
      healed_sel   TEXT    NOT NULL,
      strategy     TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );

    CREATE TABLE IF NOT EXISTS testgen_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT    NOT NULL UNIQUE,
      input_type   TEXT    NOT NULL,   -- 'story' | 'nl' | 'recording'
      input_text   TEXT,
      output_code  TEXT,
      filename     TEXT,
      test_count   INTEGER DEFAULT 0,
      quality_score INTEGER DEFAULT 0,
      status       TEXT    DEFAULT 'pending',  -- 'pending' | 'complete' | 'error'
      error        TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at   INTEGER NOT NULL,
      ended_at     INTEGER,
      total_calls  INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      total_cost   REAL    DEFAULT 0,
      provider     TEXT
    );
  `);
}

// ── Insert helpers ────────────────────────────────────────────────────────────

export interface LLMCallRecord {
  callId:       string;
  provider:     string;
  operation:    string;
  latencyMs?:   number;
  inputTokens:  number;
  outputTokens: number;
  cacheTokens:  number;
  costUsd:      number;
  success:      boolean;
  error?:       string;
}

export function insertLLMCall(rec: LLMCallRecord): void {
  try {
    getDb().prepare(`
      INSERT INTO llm_calls
        (call_id, provider, operation, latency_ms, input_tokens, output_tokens, cache_tokens, cost_usd, success, error)
      VALUES
        (@callId, @provider, @operation, @latencyMs, @inputTokens, @outputTokens, @cacheTokens, @costUsd, @success, @error)
    `).run({ ...rec, success: rec.success ? 1 : 0 });
  } catch { /* non-fatal — DB write failure must never crash a test run */ }
}

export interface VisualTestRecord {
  pageName:  string;
  status:    'pass' | 'fail';
  diffCount: number;
  diffPct:   number;
  provider?: string;
}

export function insertVisualTest(rec: VisualTestRecord): void {
  try {
    getDb().prepare(`
      INSERT INTO visual_tests (page_name, status, diff_count, diff_pct, provider)
      VALUES (@pageName, @status, @diffCount, @diffPct, @provider)
    `).run(rec);
  } catch { /* non-fatal */ }
}

export interface HealingRecord {
  originalSel: string;
  healedSel:   string;
  strategy?:   string;
}

export function insertHealingEvent(rec: HealingRecord): void {
  try {
    getDb().prepare(`
      INSERT INTO healing_events (original_sel, healed_sel, strategy)
      VALUES (@originalSel, @healedSel, @strategy)
    `).run(rec);
  } catch { /* non-fatal */ }
}

export interface TestGenRecord {
  sessionId:    string;
  inputType:    string;
  inputText?:   string;
  outputCode?:  string;
  filename?:    string;
  testCount?:   number;
  qualityScore?: number;
  status:       'pending' | 'complete' | 'error';
  error?:       string;
}

export function upsertTestGen(rec: TestGenRecord): void {
  try {
    getDb().prepare(`
      INSERT INTO testgen_sessions
        (session_id, input_type, input_text, output_code, filename, test_count, quality_score, status, error)
      VALUES
        (@sessionId, @inputType, @inputText, @outputCode, @filename, @testCount, @qualityScore, @status, @error)
      ON CONFLICT(session_id) DO UPDATE SET
        output_code   = excluded.output_code,
        filename      = excluded.filename,
        test_count    = excluded.test_count,
        quality_score = excluded.quality_score,
        status        = excluded.status,
        error         = excluded.error
    `).run({ testCount: 0, qualityScore: 0, ...rec });
  } catch { /* non-fatal */ }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getRecentLLMCalls(limit = 50): unknown[] {
  try {
    return getDb()
      .prepare('SELECT * FROM llm_calls ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  } catch { return []; }
}

export function getLLMCallStats(sinceEpoch?: number): unknown {
  try {
    const since = sinceEpoch ?? 0;
    return getDb().prepare(`
      SELECT
        provider,
        COUNT(*)         AS total_calls,
        SUM(input_tokens + output_tokens) AS total_tokens,
        SUM(cost_usd)    AS total_cost,
        AVG(latency_ms)  AS avg_latency,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
      FROM llm_calls
      WHERE created_at > ?
      GROUP BY provider
    `).all(since);
  } catch { return []; }
}

export function getRecentTestGenSessions(limit = 20): unknown[] {
  try {
    return getDb()
      .prepare('SELECT session_id, input_type, filename, test_count, quality_score, status, created_at FROM testgen_sessions ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  } catch { return []; }
}

export function getTestGenBySessionId(sessionId: string): unknown {
  try {
    return getDb()
      .prepare('SELECT * FROM testgen_sessions WHERE session_id = ?')
      .get(sessionId);
  } catch { return null; }
}

export function getRecentVisualTests(limit = 30): unknown[] {
  try {
    return getDb()
      .prepare('SELECT * FROM visual_tests ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  } catch { return []; }
}

export function getRecentHealingEvents(limit = 30): unknown[] {
  try {
    return getDb()
      .prepare('SELECT * FROM healing_events ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  } catch { return []; }
}

export function getDbPath(): string { return DB_PATH; }
export function getDbSizeBytes(): number {
  try { return fs.statSync(DB_PATH).size; } catch { return 0; }
}

// This ai ops and jarvis dashboard revamp and build on Next.js + Node.js using TS. keep it lightweight and aligned with the ai/llm project what we are building.