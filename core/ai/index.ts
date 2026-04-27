// ── Core client & providers ──────────────────────────────────────────────────
export { AIClient }                              from './AIClient';
export type { IAIProvider, CompleteParams, VisionParams, AIImage } from './providers/IAIProvider';

// ── Feature modules ──────────────────────────────────────────────────────────
export { TestGenerator }                         from './TestGenerator';
export { SelfHealingLocator, SelfHealingPage }   from './SelfHealingLocator';
export { VisualAITester }                        from './VisualAITester';
export { TestDataFactory }                       from './TestDataFactory';
export { ResponsiveTester, VIEWPORT_MATRIX }     from './ResponsiveTester';
export type { ViewportProfile, ResponsiveResult, ResponsiveIssue } from './ResponsiveTester';

// ── Multi-agent pipeline ─────────────────────────────────────────────────────
export { AgentGraph, linearGraph, emitStage }    from './agents/AgentGraph';
export { testPlannerAgent }                      from './agents/TestPlannerAgent';
export { testWriterAgent }                       from './agents/TestWriterAgent';
export { testValidatorAgent }                    from './agents/TestValidatorAgent';
export { squishtestWriterAgent }                 from './agents/SquishtestWriterAgent';
export type { SquishtestResult }                 from './agents/SquishtestWriterAgent';
export type { AgentState, AgentFn }              from './agents/AgentGraph';
export type { PlannerState }                     from './agents/TestPlannerAgent';
export type { WriterState }                      from './agents/TestWriterAgent';
export type { ValidatorState }                   from './agents/TestValidatorAgent';

// ── Real-time recorder ───────────────────────────────────────────────────────
export { TestRecorder, serializeActionsForAI }   from './recorder/TestRecorder';
export { captureScript }                         from './recorder/ActionCapture';
export type { RecordedAction, RecordedActionType } from './recorder/ActionCapture';

// ── AI Ops infrastructure ────────────────────────────────────────────────────
export { aiEventBus }                            from './ops/AIEventBus';
export { costTracker }                           from './ops/CostTracker';
export { langSmithTracer }                       from './ops/LangSmithTracer';
export type {
  LLMStartEvent, LLMEndEvent,
  HealingEvent, VisualEvent, RecorderActionEvent, TestGenEvent,
  BudgetExceededEvent,
}                                                from './ops/AIEventBus';
export type { BudgetLimits, BudgetCheckResult }  from './ops/CostTracker';

// ── Zod schemas ──────────────────────────────────────────────────────────────
export {
  GeneratedUserSchema, GeneratedProductSchema,
  TestPlanSchema, TestCaseSchema, TestStepSchema,
  ValidationReportSchema, VisualComparisonResultSchema,
  SelectorAlternativesSchema,
}                                                from './schema';
export type {
  GeneratedUserData, GeneratedProductData,
  TestPlan, TestCase, TestStep,
  ValidationReport, VisualComparisonResultData,
}                                                from './schema';

// ── Legacy types (backward-compat) ───────────────────────────────────────────
export type {
  HealedSelector, HealedSelectorsCache, SelectorAlternative,
  VisualDifference, VisualComparisonResult,
  GeneratedUser, GeneratedProduct, GeneratedTestSpec, TestDataType,
}                                                from './types';
