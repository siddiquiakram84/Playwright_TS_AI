import fs from 'fs';
import path from 'path';
import type { RunSummary, ProjectStat, SpecRow, SpecStatus, HistoryPoint, JarvisData } from '@/types/jarvis';

const RESULTS_FILE = process.env.RESULTS_FILE
  ?? path.resolve(process.cwd(), '../dashboard/playwright/test-results/results.json');

const HISTORY_FILE = process.env.HISTORY_FILE
  ?? path.resolve(process.cwd(), '../dashboard/jarvis/metrics-history.json');

const EMPTY_SUMMARY: RunSummary = {
  total: 0, passed: 0, failed: 0, skipped: 0,
  flaky: 0, passRate: 0, duration: 0, startTime: new Date().toISOString(),
};

// ── Raw Playwright JSON types ─────────────────────────────────────────────────
interface RawResult {
  status:   string;
  duration: number;
  retry:    number;
  error?:   { message?: string };
}

interface RawTest {
  status:      string;  // 'expected'|'unexpected'|'skipped'|'flaky'
  projectName: string;
  results:     RawResult[];
}

interface RawSpec {
  title:  string;
  ok:     boolean;
  id:     string;
  file:   string;
  line?:  number;
  tests:  RawTest[];
}

interface RawSuite {
  title:  string;
  file?:  string;
  specs:  RawSpec[];
  suites: RawSuite[];
}

interface RawStats {
  startTime: string;
  duration:  number;
  expected:  number;
  unexpected:number;
  skipped:   number;
  flaky:     number;
}

interface RawReport {
  stats:  RawStats;
  suites: RawSuite[];
}

// ── Map Playwright status string → SpecStatus ─────────────────────────────────
function mapStatus(testStatus: string, resultStatus?: string): SpecStatus {
  if (testStatus === 'flaky')      return 'flaky';
  if (testStatus === 'skipped')    return 'skipped';
  if (testStatus === 'expected')   return 'passed';
  if (resultStatus === 'timedOut') return 'timedOut';
  return 'failed';
}

// ── Walk the suite tree and collect specs ─────────────────────────────────────
function collectSpecs(suites: RawSuite[]): { specs: SpecRow[]; projects: Record<string, ProjectStat> } {
  const specs: SpecRow[]                     = [];
  const projects: Record<string, ProjectStat> = {};

  function walk(suite: RawSuite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const proj   = test.projectName ?? 'default';
        const result = test.results?.[0];
        const status = mapStatus(test.status, result?.status);
        const dur    = result?.duration ?? 0;
        const retry  = result?.retry    ?? 0;

        if (!projects[proj]) {
          projects[proj] = { name: proj, total: 0, passed: 0, failed: 0, skipped: 0 };
        }
        projects[proj].total++;
        if (status === 'passed' || status === 'flaky') projects[proj].passed++;
        else if (status === 'skipped')                 projects[proj].skipped++;
        else                                           projects[proj].failed++;

        specs.push({
          id:       `${spec.id ?? spec.file}-${test.projectName}`,
          title:    spec.title,
          file:     spec.file ?? suite.file ?? '',
          project:  proj,
          status,
          duration: dur,
          error:    result?.error?.message?.slice(0, 200),
          retry,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  }

  for (const suite of suites) walk(suite);
  return { specs, projects };
}

// ── Append to history file ────────────────────────────────────────────────────
function appendHistory(summary: RunSummary): void {
  let history: HistoryPoint[] = [];
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as HistoryPoint[];
    }
  } catch { /* ignore */ }

  const last = history[history.length - 1];
  if (!last || last.startTime !== summary.startTime) {
    history.push({ ...summary, recordedAt: new Date().toISOString() });
    if (history.length > 60) history = history.slice(-60);
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch { /* read-only mount — silent */ }
  }
}

export function loadHistory(): HistoryPoint[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as HistoryPoint[];
    }
  } catch { /* ignore */ }
  return [];
}

// ── Main parse function ───────────────────────────────────────────────────────
export function parseResults(): JarvisData {
  if (!fs.existsSync(RESULTS_FILE)) {
    return {
      status: 'no_data', message: 'No results.json found — run tests first.',
      summary: EMPTY_SUMMARY, projects: [], specs: [], failures: [], slowTests: [],
      history: loadHistory(), lastUpdated: new Date().toISOString(),
    };
  }

  let report: RawReport;
  try {
    report = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8')) as RawReport;
  } catch {
    return {
      status: 'error', message: 'Could not parse results.json.',
      summary: EMPTY_SUMMARY, projects: [], specs: [], failures: [], slowTests: [],
      history: loadHistory(), lastUpdated: new Date().toISOString(),
    };
  }

  const s       = report.stats;
  const total   = (s.expected ?? 0) + (s.unexpected ?? 0) + (s.skipped ?? 0);
  const passed  = s.expected  ?? 0;
  const failed  = s.unexpected ?? 0;
  const skipped = s.skipped   ?? 0;
  const flaky   = s.flaky     ?? 0;
  const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

  const summary: RunSummary = {
    total, passed, failed, skipped, flaky, passRate,
    duration:  s.duration  ?? 0,
    startTime: s.startTime ?? new Date().toISOString(),
  };

  const { specs, projects } = collectSpecs(report.suites ?? []);

  const failures  = specs.filter(s => s.status === 'failed' || s.status === 'timedOut')
                         .sort((a, b) => b.duration - a.duration)
                         .slice(0, 10);
  const slowTests = [...specs].sort((a, b) => b.duration - a.duration).slice(0, 10);

  appendHistory(summary);

  return {
    status:      'ok',
    summary,
    projects:    Object.values(projects),
    specs,
    failures,
    slowTests,
    history:     loadHistory(),
    lastUpdated: new Date().toISOString(),
  };
}
