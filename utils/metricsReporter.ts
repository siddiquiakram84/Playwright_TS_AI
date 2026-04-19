import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

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

export class MetricsReporter {
  private writeApi: WriteApi;
  private readonly resultsPath: string;

  constructor(
    influxUrl: string,
    token: string,
    org: string,
    bucket: string,
    resultsPath = 'test-results/results.json',
  ) {
    const client = new InfluxDB({ url: influxUrl, token });
    this.writeApi = client.getWriteApi(org, bucket, 'ms');
    this.resultsPath = path.resolve(process.cwd(), resultsPath);
  }

  async pushMetrics(): Promise<void> {
    if (!fs.existsSync(this.resultsPath)) {
      throw new Error(`Results file not found: ${this.resultsPath}. Run tests first.`);
    }

    const raw = fs.readFileSync(this.resultsPath, 'utf-8');
    const report: PlaywrightJsonReport = JSON.parse(raw);

    const { testMetrics, runMetrics } = this.parseReport(report);

    logger.info(`Parsed ${testMetrics.length} test cases across ${runMetrics.length} projects`);

    for (const metric of testMetrics) {
      this.writeApi.writePoint(
        new Point('test_case')
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
        new Point('test_run')
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
