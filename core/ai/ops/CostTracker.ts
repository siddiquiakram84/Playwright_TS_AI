/**
 * Tracks token usage and estimates USD cost for each LLM provider/model.
 * Accumulates totals in-process; reset on server restart.
 */

interface ModelPricing {
  inputPerM:       number; // USD per 1M input tokens
  outputPerM:      number; // USD per 1M output tokens
  cacheReadPerM?:  number; // USD per 1M cache-read tokens  (~10% of input)
  cacheWritePerM?: number; // USD per 1M cache-write tokens (~125% of input)
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerM: 3.00,  outputPerM: 15.00, cacheReadPerM: 0.30,  cacheWritePerM: 3.75  },
  'claude-opus-4-7':   { inputPerM: 15.00, outputPerM: 75.00, cacheReadPerM: 1.50,  cacheWritePerM: 18.75 },
  'claude-haiku-4-5':  { inputPerM: 0.80,  outputPerM: 4.00,  cacheReadPerM: 0.08,  cacheWritePerM: 1.00  },
  'llama3.2':          { inputPerM: 0,      outputPerM: 0 },
  'llava':             { inputPerM: 0,      outputPerM: 0 },
  'mistral':           { inputPerM: 0,      outputPerM: 0 },
  'moondream':         { inputPerM: 0,      outputPerM: 0 },
  'ollama':            { inputPerM: 0,      outputPerM: 0 },
};

const DEFAULT_PRICING: ModelPricing = { inputPerM: 1.00, outputPerM: 5.00 };

interface SessionTotals {
  calls:             number;
  inputTokens:       number;
  outputTokens:      number;
  cacheHitTokens:    number;
  cacheWriteTokens:  number;
  estimatedCostUsd:  number;
}

export interface BudgetLimits {
  tokenLimit:   number; // 0 = unlimited
  costLimitUsd: number; // 0 = unlimited
}

export interface BudgetCheckResult {
  exceeded: boolean;
  type?:    'token' | 'cost';
  used:     number;
  limit:    number;
}

class CostTracker {
  private static _instance: CostTracker;
  private totals: SessionTotals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 };
  private limits: BudgetLimits  = {
    tokenLimit:   parseInt(process.env.AI_TOKEN_LIMIT    ?? '0'),
    costLimitUsd: parseFloat(process.env.AI_COST_LIMIT_USD ?? '0'),
  };

  static getInstance(): CostTracker {
    if (!CostTracker._instance) CostTracker._instance = new CostTracker();
    return CostTracker._instance;
  }

  record(model: string, inputTokens: number, outputTokens: number, cacheHitTokens = 0, cacheWriteTokens = 0): number {
    const pricing = PRICING[model] ?? DEFAULT_PRICING;

    const cost =
      (inputTokens      / 1_000_000) * pricing.inputPerM             +
      (outputTokens     / 1_000_000) * pricing.outputPerM            +
      (cacheHitTokens   / 1_000_000) * (pricing.cacheReadPerM  ?? 0) +
      (cacheWriteTokens / 1_000_000) * (pricing.cacheWritePerM ?? 0);

    this.totals.calls++;
    this.totals.inputTokens       += inputTokens;
    this.totals.outputTokens      += outputTokens;
    this.totals.cacheHitTokens    += cacheHitTokens;
    this.totals.cacheWriteTokens  += cacheWriteTokens;
    this.totals.estimatedCostUsd  += cost;

    return cost;
  }

  estimate(model: string, inputTokens: number, outputTokens: number, cacheHitTokens = 0, cacheWriteTokens = 0): number {
    const pricing = PRICING[model] ?? DEFAULT_PRICING;
    return (
      (inputTokens      / 1_000_000) * pricing.inputPerM             +
      (outputTokens     / 1_000_000) * pricing.outputPerM            +
      (cacheHitTokens   / 1_000_000) * (pricing.cacheReadPerM  ?? 0) +
      (cacheWriteTokens / 1_000_000) * (pricing.cacheWritePerM ?? 0)
    );
  }

  getSessionTotals(): Readonly<SessionTotals> {
    return { ...this.totals };
  }

  getLimits(): Readonly<BudgetLimits> {
    return { ...this.limits };
  }

  setLimits(tokenLimit: number, costLimitUsd: number): void {
    this.limits = { tokenLimit, costLimitUsd };
  }

  checkLimits(): BudgetCheckResult {
    const totalTokens = this.totals.inputTokens + this.totals.outputTokens;
    if (this.limits.tokenLimit > 0 && totalTokens >= this.limits.tokenLimit) {
      return { exceeded: true, type: 'token', used: totalTokens, limit: this.limits.tokenLimit };
    }
    if (this.limits.costLimitUsd > 0 && this.totals.estimatedCostUsd >= this.limits.costLimitUsd) {
      return { exceeded: true, type: 'cost', used: this.totals.estimatedCostUsd, limit: this.limits.costLimitUsd };
    }
    return { exceeded: false, used: 0, limit: 0 };
  }

  reset(): void {
    this.totals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 };
  }
}

export const costTracker = CostTracker.getInstance();
