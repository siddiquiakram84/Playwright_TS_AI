import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// ─── Minimal local types so compilation succeeds whether or not the InfluxDB
//     package is installed (it is listed as an optional dependency).
interface WriteApiLike {
  writePoint(point: unknown): void;
  close(): Promise<void>;
}

interface PointLike {
  tag(key: string, value: string): this;
  stringField(key: string, value: string): this;
  intField(key: string, value: number): this;
  floatField(key: string, value: number): this;
  timestamp(value: Date): this;
}

// ─── Dynamic load — graceful if package absent ────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
let InfluxDBCtor: any | null = null;
let PointCtor: (new (measurement: string) => PointLike) | null = null;

try {
  const m = require('@influxdata/influxdb-client') as {
    InfluxDB: new (opts: { url: string; token: string }) => {
      getWriteApi(org: string, bucket: string, precision: string): WriteApiLike;
    };
    Point: new (measurement: string) => PointLike;
  };
  InfluxDBCtor = m.InfluxDB;
  PointCtor = m.Point;
} catch {
  // @influxdata/influxdb-client not installed — MetricsReporter.pushMetrics() will throw
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface PlaywrightTestResult {
  title: string;
  projectName: string;
  results: Array<{ status: string; duration: number; startTime: string }>;
  ok: boolean;
}

interface PlaywrightSpec {
  title: string;
  tests: PlaywrightTestResult[];
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSpec[];
}

interface PlaywrightJsonReport {
  suites: PlaywrightSpec[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
}

interface TestMetric {
  project: string;
  suite: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  startTime: Date;
}

interface RunMetric {
  project: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
  passRate: number;
  startTime: Date;
}

// ─── MetricsReporter ──────────────────────────────────────────────────────────
export class MetricsReporter {
  private writeApi: WriteApiLike | null = null;
  private readonly resultsPath: string;

  constructor(
    influxUrl: string,
    token: string,
    org: string,
    bucket: string,
    resultsPath = 'test-results/results.json',
  ) {
    if (!InfluxDBCtor || !PointCtor) {
      logger.warn(
        'MetricsReporter: @influxdata/influxdb-client is not installed. ' +
        'Run "npm install @influxdata/influxdb-client" to enable InfluxDB metrics.',
      );
    } else {
      const client = new InfluxDBCtor({ url: influxUrl, token });
      this.writeApi = client.getWriteApi(org, bucket, 'ms');
    }
    this.resultsPath = path.resolve(process.cwd(), resultsPath);
  }

  async pushMetrics(): Promise<void> {
    if (!this.writeApi || !PointCtor) {
      throw new Error(
        'InfluxDB client unavailable. Install it first:\n  npm install @influxdata/influxdb-client',
      );
    }

    if (!fs.existsSync(this.resultsPath)) {
      throw new Error(`Results file not found: ${this.resultsPath}. Run tests first.`);
    }

    const raw = fs.readFileSync(this.resultsPath, 'utf-8');
    const report: PlaywrightJsonReport = JSON.parse(raw);

    const { testMetrics, runMetrics } = this.parseReport(report);
    logger.info(`Parsed ${testMetrics.length} test cases across ${runMetrics.length} projects`);

    for (const metric of testMetrics) {
      this.writeApi.writePoint(
        new PointCtor('test_case')
          .tag('project', metric.project)
          .tag('suite', metric.suite)
          .tag('status', metric.status)
          .stringField('title', metric.title)
          .intField('duration', metric.duration)
          .timestamp(metric.startTime),
      );
    }

    for (const run of runMetrics) {
      this.writeApi.writePoint(
        new PointCtor('test_run')
          .tag('project', run.project)
          .intField('total', run.total)
          .intField('passed', run.passed)
          .intField('failed', run.failed)
          .intField('skipped', run.skipped)
          .intField('flaky', run.flaky)
          .intField('duration', run.duration)
          .floatField('pass_rate', run.passRate)
          .timestamp(run.startTime),
      );
    }

    await this.writeApi.close();
    logger.info(`Metrics pushed: ${testMetrics.length} tests, ${runMetrics.length} run summaries`);
  }

  private parseReport(report: PlaywrightJsonReport): {
    testMetrics: TestMetric[];
    runMetrics: RunMetric[];
  } {
    const testMetrics: TestMetric[] = [];
    const projectMap = new Map<string, { passed: number; failed: number; skipped: number; flaky: number; duration: number }>();
    const runStartTime = new Date(report.stats.startTime);

    const walk = (suite: PlaywrightSpec, parentTitle = '') => {
      const currentTitle = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;

      for (const test of suite.tests ?? []) {
        const result = test.results?.[0];
        if (!result) continue;

        const project = test.projectName ?? 'unknown';
        const status = result.status as TestMetric['status'];
        const duration = result.duration ?? 0;
        const startTime = result.startTime ? new Date(result.startTime) : runStartTime;

        testMetrics.push({ project, suite: suite.title, title: test.title, status, duration, startTime });

        if (!projectMap.has(project)) {
          projectMap.set(project, { passed: 0, failed: 0, skipped: 0, flaky: 0, duration: 0 });
        }
        const counts = projectMap.get(project)!;
        counts.duration += duration;
        if (status === 'passed') counts.passed++;
        else if (status === 'failed') counts.failed++;
        else if (status === 'skipped') counts.skipped++;
        else if (status === 'flaky') counts.flaky++;
      }

      for (const child of [...(suite.suites ?? []), ...(suite.specs ?? [])]) {
        walk(child, currentTitle);
      }
    };

    for (const suite of report.suites) {
      walk(suite);
    }

    const runMetrics: RunMetric[] = Array.from(projectMap.entries()).map(([project, counts]) => {
      const total = counts.passed + counts.failed + counts.skipped + counts.flaky;
      return {
        project,
        total,
        ...counts,
        passRate: total > 0 ? (counts.passed / total) * 100 : 0,
        startTime: runStartTime,
      };
    });

    return { testMetrics, runMetrics };
  }
}
