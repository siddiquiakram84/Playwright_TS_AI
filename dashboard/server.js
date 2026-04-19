#!/usr/bin/env node
// JARVIS Dashboard — Node.js HTTP server (zero external deps)
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT          = parseInt(process.env.DASHBOARD_PORT ?? '9090');
const RESULTS_FILE  = path.resolve(__dirname, '../test-results/results.json');
const ALLURE_DIR    = path.resolve(__dirname, '../allure-results');
const HISTORY_FILE  = path.resolve(__dirname, 'metrics-history.json');

// ─── Parse Playwright JSON report ─────────────────────────────────────────────
function parseResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    return { status: 'no_data', message: 'No test-results/results.json found. Run tests first.' };
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  } catch {
    return { status: 'parse_error', message: 'Could not parse results.json' };
  }

  const stats       = report.stats ?? {};
  const total       = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.skipped ?? 0);
  const passed      = stats.expected  ?? 0;
  const failed      = stats.unexpected ?? 0;
  const skipped     = stats.skipped   ?? 0;
  const flaky       = stats.flaky     ?? 0;
  const passRate    = total > 0 ? Math.round((passed / total) * 100 * 10) / 10 : 0;
  const duration    = stats.duration  ?? 0;
  const startTime   = stats.startTime ?? new Date().toISOString();

  const projectMap  = {};
  const failures    = [];
  const slowTests   = [];

  const walk = (suite, projectName = 'unknown') => {
    const tests = suite.tests ?? [];
    for (const test of tests) {
      const proj   = test.projectName ?? projectName;
      const result = (test.results ?? [])[0];
      if (!result) continue;

      const status   = result.status ?? 'unknown';
      const dur      = result.duration ?? 0;
      const title    = test.title ?? 'Unnamed';
      const suiteName = suite.title ?? '';

      if (!projectMap[proj]) projectMap[proj] = { total: 0, passed: 0, failed: 0, skipped: 0 };
      projectMap[proj].total++;
      if (status === 'passed') projectMap[proj].passed++;
      else if (status === 'failed') { projectMap[proj].failed++; failures.push({ title, suite: suiteName, project: proj, duration: dur }); }
      else if (status === 'skipped') projectMap[proj].skipped++;

      slowTests.push({ title, suite: suiteName, project: proj, duration: dur, status });
    }

    for (const child of [...(suite.suites ?? []), ...(suite.specs ?? [])]) {
      walk(child, projectName);
    }
  };

  for (const suite of report.suites ?? []) {
    walk(suite);
  }

  slowTests.sort((a, b) => b.duration - a.duration);

  const result = {
    status: 'ok',
    summary: { total, passed, failed, skipped, flaky, passRate, duration, startTime },
    projects: Object.entries(projectMap).map(([name, counts]) => ({ name, ...counts })),
    failures: failures.slice(0, 10),
    slowTests: slowTests.slice(0, 10),
    lastUpdated: new Date().toISOString(),
  };

  appendHistory(result.summary);
  return result;
}

// ─── Persist run history for trend chart ──────────────────────────────────────
function appendHistory(summary) {
  let history = [];
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }

  const last = history[history.length - 1];
  if (!last || last.startTime !== summary.startTime) {
    history.push({ ...summary, recordedAt: new Date().toISOString() });
    if (history.length > 60) history = history.slice(-60);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

// ─── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/results') {
    const data = JSON.stringify(parseResults());
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(data);
  }

  if (url === '/api/history') {
    const data = JSON.stringify(loadHistory());
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(data);
  }

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
  }

  const filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  const ext      = path.extname(filePath).toLowerCase();

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (url !== '/') {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(500);
      return res.end('Server error');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ◈ JARVIS Dashboard running at http://localhost:${PORT}\n`);
  console.log(`  API  → http://localhost:${PORT}/api/results`);
  console.log(`  Hist → http://localhost:${PORT}/api/history\n`);
});

server.on('error', err => { console.error('Server error:', err.message); process.exit(1); });
