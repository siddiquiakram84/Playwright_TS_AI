/**
 * AI Ops Dashboard + Admin API
 *
 * Endpoints:
 *   GET  /              → dashboard HTML
 *   GET  /events        → SSE stream of live AI events
 *   POST /api/auth      → exchange admin password for bearer token
 *   GET  /api/config    → current provider config (requires auth)
 *   PUT  /api/config    → update provider + keys (requires auth)
 *   GET  /api/metrics   → session cost + call totals (public)
 *   GET  /health        → liveness probe
 *
 * Start: npx tsx dashboard/ai-ops/server.ts
 * Port:  AI_OPS_PORT (default 9091)
 */

import * as http      from 'http';
import * as fs        from 'fs';
import * as path      from 'path';
import * as crypto    from 'crypto';
import * as dotenv    from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Dynamically import AI modules to avoid loading them before dotenv
async function startServer(): Promise<void> {
  const { aiEventBus }  = await import('../../core/ai/ops/AIEventBus');
  const { costTracker } = await import('../../core/ai/ops/CostTracker');

  const PORT          = parseInt(process.env.AI_OPS_PORT ?? '9093');
  const ADMIN_SECRET  = process.env.ADMIN_SECRET ?? 'changeme';
  const ADMIN_TOKEN   = crypto.createHmac('sha256', ADMIN_SECRET).update('ai-ops').digest('hex');
  const HTML_PATH     = path.resolve(__dirname, 'index.html');

  // ── SSE client registry ──────────────────────────────────────────────────
  const sseClients = new Set<http.ServerResponse>();

  function broadcast(eventName: string, data: unknown): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try { client.write(payload); } catch { sseClients.delete(client); }
    }
  }

  // Forward all AI bus events to SSE clients
  aiEventBus.on('llm:start',       e => broadcast('llm-start',        e));
  aiEventBus.on('llm:end',         e => broadcast('llm-end',          { ...e, totals: costTracker.getSessionTotals() }));
  aiEventBus.on('healing',         e => broadcast('healing',           e));
  aiEventBus.on('visual',          e => broadcast('visual',            e));
  aiEventBus.on('recorder:action', e => broadcast('recorder-action',   e));
  aiEventBus.on('testgen',         e => broadcast('testgen',           e));
  aiEventBus.on('admin',           e => broadcast('admin',             e));

  // ── HTTP server ──────────────────────────────────────────────────────────
  const server = http.createServer((req, res) => {
    const url    = req.url ?? '/';
    const method = req.method ?? 'GET';

    // CORS
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Dashboard HTML
    if (method === 'GET' && (url === '/' || url === '/index.html')) {
      if (fs.existsSync(HTML_PATH)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(HTML_PATH));
      } else {
        res.writeHead(404); res.end('Dashboard HTML not found');
      }
      return;
    }

    // Health
    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', provider: process.env.AI_PROVIDER ?? 'local' }));
      return;
    }

    // SSE stream
    if (method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      // Send current metrics as initial state
      res.write(`event: metrics\ndata: ${JSON.stringify(costTracker.getSessionTotals())}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Public metrics
    if (method === 'GET' && url === '/api/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(costTracker.getSessionTotals()));
      return;
    }

    // Auth
    if (method === 'POST' && url === '/api/auth') {
      readBody(req).then(body => {
        const { password } = JSON.parse(body || '{}');
        if (password === ADMIN_SECRET) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token: ADMIN_TOKEN }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid password' }));
        }
      });
      return;
    }

    // Config endpoints — GET is public (no sensitive data), PUT requires auth
    const authHeader = req.headers.authorization ?? '';
    const token      = authHeader.replace('Bearer ', '').trim();
    if ((method === 'GET' || method === 'PUT') && url === '/api/config') {
      if (method === 'PUT' && token !== ADMIN_TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      if (method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          provider:         process.env.AI_PROVIDER ?? 'local',
          ollamaBaseUrl:    process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
          ollamaModel:      process.env.OLLAMA_MODEL ?? 'llama3.2',
          ollamaVisionModel:process.env.OLLAMA_VISION_MODEL ?? 'llava',
          hasAnthropicKey:  !!(process.env.ANTHROPIC_API_KEY),
          langSmithEnabled: process.env.LANGCHAIN_TRACING_V2 === 'true',
        }));
      } else {
        readBody(req).then(body => {
          const config = JSON.parse(body || '{}');
          // Update in-process env (changes apply to new AIClient instances)
          if (config.provider)          process.env.AI_PROVIDER           = config.provider;
          if (config.anthropicApiKey)   process.env.ANTHROPIC_API_KEY     = config.anthropicApiKey;
          if (config.ollamaModel)       process.env.OLLAMA_MODEL          = config.ollamaModel;
          if (config.ollamaBaseUrl)     process.env.OLLAMA_BASE_URL       = config.ollamaBaseUrl;
          if (config.langSmithApiKey)   process.env.LANGCHAIN_API_KEY     = config.langSmithApiKey;
          if (config.langSmithProject)  process.env.LANGCHAIN_PROJECT     = config.langSmithProject;
          if (config.langSmithEnabled !== undefined) {
            process.env.LANGCHAIN_TRACING_V2 = config.langSmithEnabled ? 'true' : 'false';
          }

          // Reset AI singleton so next call picks up new provider
          import('../../core/ai/AIClient').then(({ AIClient }) => AIClient.reset());

          aiEventBus.emitAdmin({ action: 'config-changed', provider: config.provider, timestamp: Date.now() });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      }
      return;
    }

    // Cross-process event forwarder — test workers POST here so their AI
    // events appear on the dashboard in real time (fire-and-forget from worker).
    if (method === 'POST' && url === '/api/events') {
      readBody(req).then(body => {
        try {
          const { event, data } = JSON.parse(body);
          // Keep server-side metrics in sync so /api/metrics reflects forwarded calls
          if (event === 'llm:end') {
            const e = data as { provider?: string; inputTokens?: number; outputTokens?: number; cacheHitTokens?: number };
            costTracker.record(e.provider ?? 'ollama', e.inputTokens ?? 0, e.outputTokens ?? 0, e.cacheHitTokens ?? 0);
          }
          // Re-emit onto the local bus — the registered on('llm:*') listeners handle broadcast
          aiEventBus.emit(event as string, data);
        } catch { /* malformed payload — ignore */ }
        res.writeHead(204); res.end();
      }).catch(() => { res.writeHead(400); res.end(); });
      return;
    }

    res.writeHead(404); res.end('Not found');
  });

  server.listen(PORT, () => {
    console.log(`\n\x1b[35m🤖 AI Ops Dashboard →  http://localhost:${PORT}\x1b[0m`);
    console.log(`   Admin panel   →  http://localhost:${PORT}  (password: ${ADMIN_SECRET === 'changeme' ? '\x1b[33mchangeme\x1b[0m (set ADMIN_SECRET in .env)' : '***'})`);
    console.log(`   Events SSE    →  http://localhost:${PORT}/events`);
    console.log(`   Metrics API   →  http://localhost:${PORT}/api/metrics\n`);
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

startServer().catch(err => { console.error(err); process.exit(1); });
