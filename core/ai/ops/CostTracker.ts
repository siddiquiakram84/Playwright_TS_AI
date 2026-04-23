/**
 * Tracks token usage and estimates USD cost for each LLM provider/model.
 * Accumulates totals in-process; reset on server restart.
 */

interface ModelPricing {
  inputPerM:  number; // USD per 1M input tokens
  outputPerM: number; // USD per 1M output tokens
  cachePerM?: number; // USD per 1M cache-read tokens (usually ~10% of input)
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6':    { inputPerM: 3.00,  outputPerM: 15.00,  cachePerM: 0.30  },
  'claude-opus-4-7':      { inputPerM: 5.00,  outputPerM: 25.00,  cachePerM: 0.50  },
  'claude-haiku-4-5':     { inputPerM: 1.00,  outputPerM: 5.00,   cachePerM: 0.10  },
  'llama3.2':             { inputPerM: 0,      outputPerM: 0                        },
  'llava':                { inputPerM: 0,      outputPerM: 0                        },
  'mistral':              { inputPerM: 0,      outputPerM: 0                        },
  'moondream':            { inputPerM: 0,      outputPerM: 0                        },
  'ollama':               { inputPerM: 0,      outputPerM: 0                        },
};

const DEFAULT_PRICING: ModelPricing = { inputPerM: 1.00, outputPerM: 5.00 };

interface SessionTotals {
  calls:            number;
  inputTokens:      number;
  outputTokens:     number;
  cacheHitTokens:   number;
  estimatedCostUsd: number;
}

class CostTracker {
  private static _instance: CostTracker;
  private totals: SessionTotals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, estimatedCostUsd: 0 };

  static getInstance(): CostTracker {
    if (!CostTracker._instance) CostTracker._instance = new CostTracker();
    return CostTracker._instance;
  }

  record(model: string, inputTokens: number, outputTokens: number, cacheHitTokens = 0): number {
    const pricing = PRICING[model] ?? DEFAULT_PRICING;

    const cost =
      (inputTokens      / 1_000_000) * pricing.inputPerM  +
      (outputTokens     / 1_000_000) * pricing.outputPerM +
      (cacheHitTokens   / 1_000_000) * (pricing.cachePerM ?? 0);

    this.totals.calls++;
    this.totals.inputTokens      += inputTokens;
    this.totals.outputTokens     += outputTokens;
    this.totals.cacheHitTokens   += cacheHitTokens;
    this.totals.estimatedCostUsd += cost;

    return cost;
  }

  estimate(model: string, inputTokens: number, outputTokens: number, cacheHitTokens = 0): number {
    const pricing = PRICING[model] ?? DEFAULT_PRICING;
    return (
      (inputTokens    / 1_000_000) * pricing.inputPerM  +
      (outputTokens   / 1_000_000) * pricing.outputPerM +
      (cacheHitTokens / 1_000_000) * (pricing.cachePerM ?? 0)
    );
  }

  getSessionTotals(): Readonly<SessionTotals> {
    return { ...this.totals };
  }

  reset(): void {
    this.totals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, estimatedCostUsd: 0 };
  }
}

export const costTracker = CostTracker.getInstance();
