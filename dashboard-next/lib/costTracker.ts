import { costTracker as _tracker } from '../../core/ai/ops/CostTracker';
export type { BudgetLimits, BudgetCheckResult } from '../../core/ai/ops/CostTracker';

const g = globalThis as typeof globalThis & { __costTracker?: typeof _tracker };
if (!g.__costTracker) g.__costTracker = _tracker;

export const costTracker = g.__costTracker;
