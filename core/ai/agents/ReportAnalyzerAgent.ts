import * as fs     from 'fs';
import * as path   from 'path';
import { logger }  from '../../utils/logger';

export type FailureCategory = 'devops' | 'bug' | 'manual' | 'summary';

export interface FailureAnalysis {
  testTitle:       string;
  category:        FailureCategory;
  reason:          string;
  errorMessage:    string;
  suggestedAction: string;
  duration:        number;
}

export interface ReportSummary {
  total:        number;
  passed:       number;
  failed:       number;
  skipped:      number;
  duration:     number;
  failures:     FailureAnalysis[];
  healedCount:  number;
}

// ── Classification patterns ───────────────────────────────────────────────────

const DEVOPS_PATTERNS = [
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /net::ERR_/i,
  /getaddrinfo/i,
  /502\s*Bad\s*Gateway/i,
  /503\s*Service\s*Unavailable/i,
  /504\s*Gateway\s*Timeout/i,
  /500\s*Internal\s*Server\s*Error/i,
  /upstream\s*connect\s*error/i,
  /connection\s*refused/i,
  /connection\s*reset/i,
  /network\s*socket\s*disconnected/i,
  /server\s*disconnected/i,
];

const MANUAL_PATTERNS = [
  /locator\..*not\s+found/i,
  /waiting\s+for\s+locator/i,
  /strict\s+mode\s+violation/i,
  /no\s+element\s+found/i,
  /element\s+is\s+not\s+attached/i,
  /test\s+data/i,
  /invalid\s+selector/i,
  /selector\s+resolved\s+to\s+hidden/i,
  /target\s+closed/i,
  /page\s+closed/i,
];

function classify(errorMsg: string): {
  category:        FailureCategory;
  reason:          string;
  suggestedAction: string;
} {
  const msg = errorMsg ?? '';

  if (DEVOPS_PATTERNS.some(p => p.test(msg))) {
    return {
      category:        'devops',
      reason:          'Network / infrastructure issue detected',
      suggestedAction: 'Check server health, network connectivity, and deployment status.',
    };
  }

  if (MANUAL_PATTERNS.some(p => p.test(msg))) {
    return {
      category:        'manual',
      reason:          'Selector failure or test-data issue — likely a test design problem',
      suggestedAction: 'Review and update test steps, locators, and test data in the manual test case.',
    };
  }

  // Default: genuine application bug
  return {
    category:        'bug',
    reason:          'Assertion / functional failure — application behaviour differs from expectation',
    suggestedAction: 'Investigate the application logic. Reproduce manually and file a dev bug fix.',
  };
}

// ── Playwright JSON report shape ──────────────────────────────────────────────

interface PWTestError  { message: string }
interface PWTestResult { status: string; duration: number; errors: PWTestError[] }
interface PWTest       { title: string; results: PWTestResult[] }
interface PWSuite      { title: string; specs?: PWTest[]; suites?: PWSuite[] }
interface PWReport     {
  stats:   { expected: number; unexpected: number; skipped: number; duration: number };
  suites:  PWSuite[];
}

export class ReportAnalyzerAgent {

  /**
   * Parse Playwright's results.json and classify every failure.
   * reportDir defaults to dashboard/playwright/test-results
   */
  analyze(reportDir?: string, healedCount = 0): ReportSummary {
    const dir        = reportDir ?? path.resolve(process.cwd(), 'dashboard/playwright/test-results');
    const reportFile = path.join(dir, 'results.json');

    if (!fs.existsSync(reportFile)) {
      logger.warn(`[ReportAnalyzerAgent] results.json not found at ${reportFile}`);
      return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, failures: [], healedCount };
    }

    let report: PWReport;
    try {
      report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as PWReport;
    } catch (e) {
      logger.error(`[ReportAnalyzerAgent] Failed to parse results.json: ${(e as Error).message}`);
      return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, failures: [], healedCount };
    }

    const failures: FailureAnalysis[] = [];
    this.walkSuites(report.suites ?? [], failures);

    const stats = report.stats ?? { expected: 0, unexpected: 0, skipped: 0, duration: 0 };
    const total  = stats.expected + stats.unexpected + (stats.skipped ?? 0);
    const passed = stats.expected;
    const failed = stats.unexpected;

    logger.info(`[ReportAnalyzerAgent] ${passed}/${total} passed — ${failures.length} failure(s) classified`);

    return {
      total,
      passed,
      failed,
      skipped:  stats.skipped ?? 0,
      duration: stats.duration ?? 0,
      failures,
      healedCount,
    };
  }

  private walkSuites(suites: PWSuite[], out: FailureAnalysis[]): void {
    for (const suite of suites) {
      for (const test of suite.specs ?? []) {
        for (const result of test.results ?? []) {
          if (result.status !== 'passed' && result.status !== 'skipped') {
            const errorMsg = (result.errors ?? []).map(e => e.message).join('\n');
            const { category, reason, suggestedAction } = classify(errorMsg);
            out.push({
              testTitle:       `${suite.title} > ${test.title}`,
              category,
              reason,
              errorMessage:    errorMsg.slice(0, 2000),
              suggestedAction,
              duration:        result.duration ?? 0,
            });
          }
        }
      }
      if (suite.suites?.length) this.walkSuites(suite.suites, out);
    }
  }
}

export const reportAnalyzer = new ReportAnalyzerAgent();
