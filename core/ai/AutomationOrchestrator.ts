import * as path         from 'path';
import { logger }        from '../utils/logger';
import { PROJECT_ROOT }  from '../utils/envConfig';
import { aiEventBus }    from './ops/AIEventBus';
import type { OrchestratorStep, OrchestratorStepStatus } from './ops/AIEventBus';
import { TestGenerator } from './TestGenerator';
import { testExecutor }  from './TestExecutor';
import { fileWriter }    from './agents/FileWriterAgent';
import { reportAnalyzer } from './agents/ReportAnalyzerAgent';
import { excelParser, ExcelParserAgent } from './agents/ExcelParserAgent';
import { ticketRouter }  from './integrations/TicketRouter';
import type { JiraCreatedIssue } from './integrations/JiraClient';
import type { FailureAnalysis }  from './agents/ReportAnalyzerAgent';
import type { GeneratedTestSpec } from './types';
import * as crypto       from 'crypto';

// ── Input types ───────────────────────────────────────────────────────────────

export type OrchestratorSource =
  | 'story'
  | 'nl'
  | 'txt'
  | 'json'
  | 'excel';

export interface OrchestratorInput {
  source:       OrchestratorSource;
  text?:        string;          // for story / nl / txt / json
  excelBuffer?: Buffer;          // for excel
  outputDir?:   string;          // where to write the spec (default: aut/tests/ai/generated)
  runTests?:    boolean;         // default true — set false to generate only
}

export interface OrchestratorResult {
  sessionId:      string;
  spec:           GeneratedTestSpec;
  artifacts?:     ReturnType<typeof fileWriter.write>;
  execution?:     Awaited<ReturnType<typeof testExecutor.run>>;
  failures?:      FailureAnalysis[];
  tickets:        Array<{ key: string; url: string; category: string }>;
  summaryTicket?: JiraCreatedIssue | null;
  timeline:       TimelineEntry[];
}

interface TimelineEntry {
  step:      OrchestratorStep | 'start' | 'end';
  status:    OrchestratorStepStatus | 'ok';
  detail:    string;
  timestamp: number;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class AutomationOrchestrator {
  private readonly generator = new TestGenerator();

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const sessionId = crypto.randomBytes(6).toString('hex');
    const timeline:  TimelineEntry[] = [];

    const log = (step: TimelineEntry['step'], status: TimelineEntry['status'], detail: string) => {
      const entry: TimelineEntry = { step, status, detail, timestamp: Date.now() };
      timeline.push(entry);
      logger.info(`[Orchestrator:${sessionId}] [${step}] ${detail}`);
      if (step !== 'start' && step !== 'end') {
        aiEventBus.emitOrchestratorStep({
          sessionId,
          step:      step as OrchestratorStep,
          status:    status as OrchestratorStepStatus,
          detail,
          timestamp: entry.timestamp,
        });
      }
    };

    log('start', 'ok', `Session started — source: ${input.source}`);

    let spec: GeneratedTestSpec;
    const tickets: OrchestratorResult['tickets'] = [];
    let summaryTicket: JiraCreatedIssue | null | undefined;

    try {
      // ── Phase 1: Parse input ──────────────────────────────────────────────
      log('parse', 'running', `Parsing ${input.source} input`);
      const prompt = await this.buildPrompt(input);
      log('parse', 'done', `Input parsed (${prompt.length} chars)`);

      // ── Phase 2: Generate tests ───────────────────────────────────────────
      log('generate', 'running', 'Running Planner → Writer → Validator pipeline');
      const outputDir  = input.outputDir ?? 'aut/tests/ai/generated';
      const outputPath = path.join(PROJECT_ROOT, outputDir);

      spec = await this.generator.fromUserStory(prompt, outputPath);
      log('generate', 'done', `${spec.testCount} test(s) generated → ${spec.filename}`);

      // spec.filename may be relative — resolve against PROJECT_ROOT
      const specAbsPath = path.isAbsolute(spec.filename)
        ? spec.filename
        : path.join(PROJECT_ROOT, spec.filename);

      // Write artifacts with backup
      log('generate', 'done', 'Writing artifacts + backup files');
      const artifacts = fileWriter.write({
        specCode: spec.code,
        specPath: specAbsPath,
      });

      if (!input.runTests) {
        log('end', 'ok', 'Generate-only mode — skipping execution');
        return { sessionId, spec, artifacts, tickets, timeline };
      }

      // ── Phase 3: Execute + self-heal ──────────────────────────────────────
      log('execute', 'running', `Executing ${spec.filename}`);
      const execution = await testExecutor.run(specAbsPath);
      log('execute', 'done',
        `${execution.passed}✓ ${execution.failed}✗ — ${execution.cycles} cycle(s), ${execution.healedCount} selector(s) healed`
      );

      if (execution.healedCount > 0) {
        log('heal', 'done', `${execution.healedCount} selector(s) auto-patched in source`);
      }

      // ── Phase 4: Analyze report ───────────────────────────────────────────
      log('analyze', 'running', 'Classifying failures from Playwright report');
      const summary = reportAnalyzer.analyze(execution.reportDir, execution.healedCount);
      const failures = summary.failures;
      log('analyze', 'done',
        `${failures.length} failure(s): ` +
        `${failures.filter(f => f.category === 'devops').length} devops, ` +
        `${failures.filter(f => f.category === 'bug').length} bugs, ` +
        `${failures.filter(f => f.category === 'manual').length} manual`
      );

      // ── Phase 5: Create Jira tickets ──────────────────────────────────────
      if (failures.length > 0) {
        log('ticket', 'running', `Creating ${failures.length} Jira ticket(s)`);

        // Group by category — one ticket per unique test title to avoid flood
        const seen = new Set<string>();
        for (const f of failures) {
          if (seen.has(f.testTitle)) continue;
          seen.add(f.testTitle);

          const ticket = await ticketRouter.routeFailure(sessionId, f);
          if (ticket) tickets.push({ key: ticket.key, url: ticket.url, category: f.category });
        }
        log('ticket', 'done', `${tickets.length} ticket(s) created`);
      }

      // ── Phase 6: Summary ticket for automation team ───────────────────────
      log('summary', 'running', 'Creating run summary ticket for automation review');
      const summaryBody = this.buildSummaryBody(sessionId, input, spec, summary, tickets, execution);
      summaryTicket = await ticketRouter.createSummaryTicket(sessionId, summaryBody);
      if (summaryTicket) {
        tickets.push({ key: summaryTicket.key, url: summaryTicket.url, category: 'summary' });
        log('summary', 'done', `Summary ticket: ${summaryTicket.key} — ${summaryTicket.url}`);
      }

      log('end', 'ok', `Pipeline complete — ${tickets.length} total ticket(s)`);

      return { sessionId, spec, artifacts, execution, failures, tickets, summaryTicket, timeline };

    } catch (err) {
      const msg = (err as Error).message;
      log('end', 'error', `Pipeline failed: ${msg}`);
      throw err;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async buildPrompt(input: OrchestratorInput): Promise<string> {
    switch (input.source) {
      case 'excel': {
        if (!input.excelBuffer) throw new Error('Excel source requires excelBuffer');
        const tcs = await excelParser.parseBuffer(input.excelBuffer);
        if (tcs.length === 0) throw new Error('No test cases found in Excel file');
        return ExcelParserAgent.toPrompt(tcs);
      }
      case 'json': {
        if (!input.text) throw new Error('JSON source requires text');
        return input.text; // TestGenerator.fromJsonTestCases handles parsing
      }
      case 'txt':
        if (!input.text) throw new Error('TXT source requires text');
        return `Convert the following manual test cases into Playwright TypeScript:\n\n${input.text}`;
      case 'nl':
      case 'story':
      default:
        if (!input.text) throw new Error(`${input.source} source requires text`);
        return input.text;
    }
  }

  private buildSummaryBody(
    sessionId:  string,
    input:      OrchestratorInput,
    spec:       GeneratedTestSpec,
    summary:    ReturnType<typeof reportAnalyzer.analyze>,
    tickets:    OrchestratorResult['tickets'],
    execution:  NonNullable<OrchestratorResult['execution']>,
  ): string {
    const failureLines = summary.failures.map(f =>
      `- [${f.category.toUpperCase()}] ${f.testTitle}: ${f.reason}`
    ).join('\n');

    const ticketLines = tickets
      .filter(t => t.category !== 'summary')
      .map(t => `- ${t.key} (${t.category}): ${t.url}`)
      .join('\n');

    return [
      `AI Automation Orchestrator — Full Run Summary`,
      `Session ID: ${sessionId}`,
      `Input Source: ${input.source}`,
      '',
      `GENERATION`,
      `Generated file: ${spec.filename}`,
      `Test count: ${spec.testCount}`,
      '',
      `EXECUTION`,
      `Cycles: ${execution.cycles}`,
      `Passed: ${summary.passed} / ${summary.total}`,
      `Failed: ${summary.failed}`,
      `Skipped: ${summary.skipped}`,
      `Duration: ${(summary.duration / 1000).toFixed(1)}s`,
      `Auto-healed selectors: ${summary.healedCount}`,
      '',
      `FAILURE ANALYSIS`,
      failureLines || 'No failures',
      '',
      `TICKETS CREATED`,
      ticketLines || 'None',
      '',
      `HUMAN CHECKPOINT`,
      `Please review the above and verify:`,
      `1. Generated test logic is correct and complete`,
      `2. Healed selectors are stable and not fragile`,
      `3. All Jira tickets are assigned to the right team`,
      `4. Any unresolved failures are investigated`,
      `5. Source backup files (.bak) can be cleaned up once stable`,
      '',
      `_This ticket was auto-created by the AI Automation Orchestrator. No manual action was taken._`,
    ].join('\n');
  }
}

export const automationOrchestrator = new AutomationOrchestrator();
