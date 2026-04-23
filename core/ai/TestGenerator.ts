import { linearGraph }             from './agents/AgentGraph';
import { testPlannerAgent, PlannerState } from './agents/TestPlannerAgent';
import { testWriterAgent, WriterState }   from './agents/TestWriterAgent';
import { testValidatorAgent, ValidatorState } from './agents/TestValidatorAgent';
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
