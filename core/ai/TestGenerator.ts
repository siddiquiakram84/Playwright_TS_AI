import { linearGraph }             from './agents/AgentGraph';
import { testPlannerAgent, PlannerState } from './agents/TestPlannerAgent';
import { testWriterAgent, WriterState }   from './agents/TestWriterAgent';
import { testValidatorAgent, ValidatorState } from './agents/TestValidatorAgent';
import { squishtestWriterAgent }  from './agents/SquishtestWriterAgent';
import { excelParser, ExcelParserAgent } from './agents/ExcelParserAgent';
import { GeneratedTestSpec }      from './types';
import { logger }                 from '../utils/logger';

/**
 * Multi-agent test generator.
 *
 *   TestPlannerAgent  → structures the requirement into a typed test plan
 *   TestWriterAgent   → converts the plan into production-grade TypeScript spec
 *   TestValidatorAgent → scores and annotates quality issues
 *
 * Driven by the AIEventBus so all stages appear live in the AI Ops dashboard.
 */

const pipeline = linearGraph<ValidatorState>(
  ['plan',     testPlannerAgent     as (state: ValidatorState, ai: import('./AIClient').AIClient) => Promise<ValidatorState>],
  ['write',    testWriterAgent      as (state: ValidatorState, ai: import('./AIClient').AIClient) => Promise<ValidatorState>],
  ['validate', testValidatorAgent],
);

export class TestGenerator {
  async fromUserStory(story: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from user story…');
    return this.run(story, 'story', outputPath);
  }

  async fromNaturalLanguage(instruction: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from natural language…');
    return this.run(instruction, 'nl', outputPath);
  }

  async fromRecording(serializedActions: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from recording…');
    return this.run(serializedActions, 'recording', outputPath);
  }

  /**
   * Generate a Playwright TypeScript spec from a structured JSON test case file.
   *
   * Accepted formats:
   *   Array of manual TCs:
   *     [{ "id":"TC-001", "title":"...", "preconditions":"...",
   *        "steps":["step 1","step 2"], "expectedResult":"..." }]
   *
   *   Existing test-data format:
   *     { "scenarios":[{"id":"...","description":"...","testData":{...}}],
   *       "constants":{...} }
   *
   * The JSON is normalised into a user-story prompt and fed through the
   * full Planner → Writer → Validator pipeline so the output matches the
   * existing POM conventions exactly.
   */
  async fromJsonTestCases(jsonContent: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from JSON test cases…');

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error('[TestGenerator] Invalid JSON — could not parse test case input');
    }

    const prompt = this.normaliseJsonToPrompt(parsed);
    return this.run(prompt, 'story', outputPath);
  }

  /**
   * Generate a Playwright TypeScript spec from a plain-text manual test case document.
   *
   * Expected TXT format (flexible — the LLM handles variations):
   *   Test Case: <title>
   *   Preconditions: <conditions>
   *   Steps:
   *   1. <step>
   *   2. <step>
   *   Expected Result: <result>
   *
   * Multiple test cases can be separated by blank lines or "---" dividers.
   */
  /**
   * Generate a Playwright TypeScript spec from an Excel (.xlsx) test case file.
   * Accepts the raw file buffer (supports upload via dashboard or CLI path).
   */
  async fromExcel(buffer: Buffer, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from Excel test cases…');
    const testCases = await excelParser.parseBuffer(buffer);
    if (testCases.length === 0) {
      throw new Error('[TestGenerator] No test cases found in Excel file');
    }
    const prompt = ExcelParserAgent.toPrompt(testCases);
    logger.info(`[TestGenerator] Excel: ${testCases.length} test case(s) → prompt`);
    return this.run(prompt, 'story', outputPath);
  }

  async fromManualTxt(txtContent: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating from manual TXT test cases…');

    const prompt =
      `Convert the following manual test cases into a production-grade Playwright TypeScript spec. ` +
      `Follow the project POM conventions and fixture patterns exactly.\n\n` +
      `MANUAL TEST CASES:\n${txtContent.trim()}`;

    return this.run(prompt, 'story', outputPath);
  }

  private normaliseJsonToPrompt(parsed: unknown): string {
    const tcs: string[] = [];

    // Format 1: array of manual TCs  [{ id, title, preconditions, steps[], expectedResult }]
    if (Array.isArray(parsed)) {
      for (const tc of parsed as Record<string, unknown>[]) {
        const steps = Array.isArray(tc['steps'])
          ? (tc['steps'] as string[]).map((s, i) => `  ${i + 1}. ${s}`).join('\n')
          : String(tc['steps'] ?? '');
        tcs.push([
          `Test Case: ${tc['id'] ?? ''} — ${tc['title'] ?? tc['description'] ?? ''}`,
          tc['preconditions'] ? `Preconditions: ${tc['preconditions']}` : '',
          steps ? `Steps:\n${steps}` : '',
          tc['expectedResult'] ? `Expected Result: ${tc['expectedResult']}` : '',
        ].filter(Boolean).join('\n'));
      }
    }

    // Format 2: { scenarios: [...], constants: {...} }
    else if (typeof parsed === 'object' && parsed !== null && 'scenarios' in parsed) {
      const obj = parsed as { scenarios: Record<string, unknown>[] };
      for (const sc of obj.scenarios ?? []) {
        tcs.push(
          `Scenario ${sc['id'] ?? ''}: ${sc['description'] ?? ''}\n` +
          `Test data: ${JSON.stringify(sc['testData'] ?? {})}`,
        );
      }
    }

    if (tcs.length === 0) {
      // Fallback: treat the raw JSON as a natural-language description
      return `Generate tests based on this specification: ${JSON.stringify(parsed)}`;
    }

    return (
      `Generate a production-grade Playwright TypeScript spec for the following test cases. ` +
      `Follow project POM conventions and fixture patterns exactly.\n\n` +
      tcs.join('\n\n---\n\n')
    );
  }

  /**
   * Generate a Squishtest Python script for a Qt/desktop application.
   * Accepts a user story, manual TC description, or feature requirement in plain text.
   * Bypasses the Playwright pipeline — emits directly to SquishtestWriterAgent.
   */
  async fromSquishStory(story: string, outputPath?: string): Promise<GeneratedTestSpec> {
    logger.info('[TestGenerator] Generating Squishtest Python script…');
    const result = await squishtestWriterAgent(story, outputPath);
    return {
      code:      result.code,
      filename:  result.filename,
      testCount: result.testCount,
    };
  }

  private async run(
    input:      string,
    inputType:  'story' | 'nl' | 'recording',
    outputPath?: string,
  ): Promise<GeneratedTestSpec> {
    const result = await pipeline.run({
      input,
      inputType,
      outputPath,
    } as Omit<ValidatorState, 'sessionId'>);

    if (result.error) {
      throw new Error(`[TestGenerator] Pipeline error: ${result.error}`);
    }

    const code      = result.code ?? '// TestGenerator: no code produced';
    const testCount = (code.match(/\btest\(/g) ?? []).length;
    const filename  = result.filename ?? `aut/tests/ai/generated/${inputType}-${Date.now()}.spec.ts`;

    if (result.validation) {
      logger.info(
        `[TestGenerator] Quality score: ${result.validation.score}/100 — ` +
        `${result.validation.issues.length} issue(s)`,
      );
      if (result.validation.issues.length > 0) {
        result.validation.issues.forEach(i =>
          logger.debug(`  [${i.severity}] ${i.message}${i.line ? ` (line ${i.line})` : ''}`),
        );
      }
    }

    return { code, filename, testCount };
  }
}
