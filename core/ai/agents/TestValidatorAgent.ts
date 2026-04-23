import { AgentFn, emitStage }    from './AgentGraph';
import { WriterState }            from './TestWriterAgent';
import { ValidationReportSchema, ValidationReport } from '../schema';
import { logger }                 from '../../utils/logger';

export interface ValidatorState extends WriterState {
  validation?: ValidationReport;
}

const SYSTEM_PROMPT = `
You are a senior code reviewer specialising in Playwright TypeScript test quality.

Evaluate the provided spec file against these criteria (return JSON only):

CORRECTNESS (40 pts)
  - Valid TypeScript syntax
  - Correct import paths (relative to aut/tests/ai/generated/)
  - All fixtures properly destructured and used
  - await on all async Playwright calls

COVERAGE (30 pts)
  - Has at least one positive and one negative/edge test
  - Each test has at least one assertion
  - Navigation happens before interactions

CONVENTION (30 pts)
  - Uses POM fixture methods — not raw page.goto() or new PageClass()
  - Test names describe user intent, not implementation
  - test.describe() wrapper present
  - No hardcoded URLs in test body

Return JSON matching exactly:
{
  "valid": boolean,
  "score": 0-100,
  "issues": [{ "severity": "error"|"warning"|"suggestion", "message": string, "line": number|null }],
  "suggestions": string[]
}
`;

export const testValidatorAgent: AgentFn<ValidatorState> = async (state, ai): Promise<ValidatorState> => {
  if (!state.code) {
    return { ...state, error: '[TestValidatorAgent] No code to validate — writer must run first' };
  }

  logger.info('[TestValidatorAgent] Validating generated spec…');
  emitStage(state.sessionId, 'validating', state.inputType);

  const validation = await ai.completeJson<ValidationReport>(
    {
      systemPrompt: SYSTEM_PROMPT,
      userMessage:
        `Validate this Playwright TypeScript spec:\n\n` +
        `\`\`\`typescript\n${state.code}\n\`\`\`\n\n` +
        `Score it and list all issues and suggestions.`,
      maxTokens: 2048,
      operation: 'validate',
    },
    ValidationReportSchema,
  );

  const errors   = validation.issues.filter(i => i.severity === 'error').length;
  const warnings = validation.issues.filter(i => i.severity === 'warning').length;

  logger.info(
    `[TestValidatorAgent] Score: ${validation.score}/100 — ` +
    `${errors} error(s), ${warnings} warning(s)`,
  );

  emitStage(state.sessionId, 'complete', state.inputType, state.code, validation.score);
  return { ...state, validation };
};
