// ── Per-run summary ───────────────────────────────────────────────────────────
export interface RunSummary {
  total:    number;
  passed:   number;
  failed:   number;
  skipped:  number;
  flaky:    number;
  passRate: number;   // 0–100
  duration: number;   // ms
  startTime:string;   // ISO
}

// ── Per-project (browser) breakdown ──────────────────────────────────────────
export interface ProjectStat {
  name:    string;
  total:   number;
  passed:  number;
  failed:  number;
  skipped: number;
}

// ── Individual spec row ───────────────────────────────────────────────────────
export type SpecStatus = 'passed' | 'failed' | 'skipped' | 'timedOut' | 'flaky';

export interface SpecRow {
  id:       string;
  title:    string;
  file:     string;
  project:  string;
  status:   SpecStatus;
  duration: number;   // ms
  error?:   string;
  retry:    number;
}

// ── History point ─────────────────────────────────────────────────────────────
export interface HistoryPoint extends RunSummary {
  recordedAt: string; // ISO
}

// ── Full API response ─────────────────────────────────────────────────────────
export interface JarvisData {
  status:     'ok' | 'no_data' | 'error';
  message?:   string;
  summary:    RunSummary;
  projects:   ProjectStat[];
  specs:      SpecRow[];
  failures:   SpecRow[];
  slowTests:  SpecRow[];
  history:    HistoryPoint[];
  lastUpdated:string;
}
