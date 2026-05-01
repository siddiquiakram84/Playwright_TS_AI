import { spawn }   from 'child_process';
import * as fs      from 'fs';
import * as path    from 'path';
import { logger }   from '../utils/logger';
import { fileWriter } from './agents/FileWriterAgent';
import { PROJECT_ROOT } from '../utils/envConfig';

export interface ExecutionResult {
  passed:       number;
  failed:       number;
  skipped:      number;
  duration:     number;
  healedCount:  number;
  reportDir:    string;
  specFile:     string;
  cycles:       number;
  exitCode:     number;
}

interface HealedEntry {
  original:  string;
  healed:    string;
  timestamp: number;
}

const MAX_HEAL_CYCLES = 2;
const HEALED_CACHE    = path.resolve(PROJECT_ROOT, 'core/ai/healed-selectors.json');
const REPORT_DIR      = path.resolve(PROJECT_ROOT, 'dashboard/playwright/test-results');

/**
 * Executes a generated spec file via `npx playwright test`.
 *
 * Self-heal loop:
 *   1. Run the spec
 *   2. If failures: read healed-selectors.json for selectors healed during this run
 *   3. Patch those selectors back into the source file (creating .bak first)
 *   4. Re-run — up to MAX_HEAL_CYCLES times
 */
export class TestExecutor {

  async run(specFile: string): Promise<ExecutionResult> {
    let cycles     = 0;
    let healedCount = 0;
    let exitCode    = 1;

    // Snapshot healed-selectors before we start so we can diff after each run
    let prevHealSnapshot = this.snapshotHealedKeys();

    while (cycles < MAX_HEAL_CYCLES + 1) {
      cycles++;
      logger.info(`[TestExecutor] Cycle ${cycles} — running ${path.basename(specFile)}`);

      exitCode = await this.execPlaywright(specFile);

      if (exitCode === 0) {
        logger.info('[TestExecutor] All tests passed');
        break;
      }

      if (cycles > MAX_HEAL_CYCLES) {
        logger.warn('[TestExecutor] Max heal cycles reached — stopping');
        break;
      }

      // Find selectors healed during this run
      const newHealings = this.diffHealedKeys(prevHealSnapshot);
      if (newHealings.length === 0) {
        logger.info('[TestExecutor] No new healings — skipping source patch');
        break;
      }

      const patched = fileWriter.patchSelectors(specFile, newHealings);
      if (patched) {
        healedCount += newHealings.length;
        logger.info(`[TestExecutor] Patched ${newHealings.length} selector(s) — re-running`);
      }

      prevHealSnapshot = this.snapshotHealedKeys();
    }

    const stats = this.parseStats();
    return {
      ...stats,
      healedCount,
      reportDir: REPORT_DIR,
      specFile,
      cycles,
      exitCode,
    };
  }

  private execPlaywright(specFile: string): Promise<number> {
    return new Promise(resolve => {
      const args = [
        'playwright', 'test', specFile,
        '--reporter=json',
        `--output=${REPORT_DIR}`,
        '--project=ui',
      ];

      const proc = spawn('npx', args, {
        cwd:   PROJECT_ROOT,
        stdio: 'pipe',
        env:   { ...process.env },
        shell: true,
      });

      proc.stdout?.on('data', (d: Buffer) => logger.debug(`[pw] ${d.toString().trim()}`));
      proc.stderr?.on('data', (d: Buffer) => logger.debug(`[pw:err] ${d.toString().trim()}`));

      proc.on('close', code => {
        // Write JSON reporter output to results.json
        resolve(code ?? 1);
      });
    });
  }

  private snapshotHealedKeys(): Set<string> {
    if (!fs.existsSync(HEALED_CACHE)) return new Set();
    try {
      const data = JSON.parse(fs.readFileSync(HEALED_CACHE, 'utf-8')) as Record<string, HealedEntry>;
      return new Set(Object.keys(data));
    } catch {
      return new Set();
    }
  }

  private diffHealedKeys(
    prevKeys: Set<string>,
  ): Array<{ original: string; healed: string }> {
    if (!fs.existsSync(HEALED_CACHE)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(HEALED_CACHE, 'utf-8')) as Record<string, HealedEntry>;
      return Object.entries(data)
        .filter(([key]) => !prevKeys.has(key))
        .map(([, entry]) => ({ original: entry.original, healed: entry.healed }));
    } catch {
      return [];
    }
  }

  private parseStats(): Pick<ExecutionResult, 'passed' | 'failed' | 'skipped' | 'duration'> {
    const resultsFile = path.join(REPORT_DIR, 'results.json');
    if (!fs.existsSync(resultsFile)) {
      return { passed: 0, failed: 0, skipped: 0, duration: 0 };
    }
    try {
      const r = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')) as {
        stats?: { expected?: number; unexpected?: number; skipped?: number; duration?: number }
      };
      const s = r.stats ?? {};
      return {
        passed:   s.expected   ?? 0,
        failed:   s.unexpected ?? 0,
        skipped:  s.skipped    ?? 0,
        duration: s.duration   ?? 0,
      };
    } catch {
      return { passed: 0, failed: 0, skipped: 0, duration: 0 };
    }
  }
}

export const testExecutor = new TestExecutor();
