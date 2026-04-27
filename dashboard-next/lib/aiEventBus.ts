/**
 * Thin re-export of the singleton AIEventBus from core.
 * Using the global{} pattern ensures the singleton survives
 * Next.js hot-module replacement in development.
 */
import { aiEventBus as _bus } from '../../core/ai/ops/AIEventBus';

export type { LLMStartEvent, LLMEndEvent, HealingEvent, VisualEvent,
              RecorderActionEvent, TestGenEvent, AdminEvent, BudgetExceededEvent,
} from '../../core/ai/ops/AIEventBus';

// In dev, Next.js may re-evaluate this module. Pin the singleton to globalThis
// so all route handlers share the exact same EventEmitter instance.
const g = globalThis as typeof globalThis & { __aiEventBus?: typeof _bus };
if (!g.__aiEventBus) g.__aiEventBus = _bus;

export const aiEventBus = g.__aiEventBus;
