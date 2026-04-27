// ── Session metrics (mirrors CostTracker.SessionTotals) ──────────────────────
export interface SessionMetrics {
  calls:            number;
  inputTokens:      number;
  outputTokens:     number;
  cacheHitTokens:   number;
  estimatedCostUsd: number;
}

// ── LLM call log ─────────────────────────────────────────────────────────────
export type CallStatus = 'pending' | 'success' | 'error';

export interface LLMCallItem {
  id:             string;
  operation:      string;
  provider:       string;
  status:         CallStatus;
  latencyMs?:     number;
  inputTokens?:   number;
  outputTokens?:  number;
  cacheHitTokens?:number;
  costUsd?:       number;
  error?:         string;
  timestamp:      number;
}

// ── Healing event ─────────────────────────────────────────────────────────────
export interface HealingItem {
  selector:    string;
  url:         string;
  healed?:     string;
  confidence?: number;
  success:     boolean;
  fromCache?:  boolean;
  timestamp:   number;
}

// ── Visual test result ────────────────────────────────────────────────────────
export interface VisualItem {
  name:        string;
  passed:      boolean;
  differences: number;
  summary:     string;
  timestamp:   number;
}

// ── Test generation event ─────────────────────────────────────────────────────
export type GenStage = 'planning' | 'writing' | 'validating' | 'complete' | 'error';

export interface TestGenItem {
  sessionId: string;
  source:    string;
  stage:     GenStage;
  input?:    string;
  output?:   string;
  score?:    number;
  timestamp: number;
}

// ── Budget ────────────────────────────────────────────────────────────────────
export interface BudgetState {
  tokenLimit:       number;
  costLimitUsd:     number;
  totalTokens:      number;
  estimatedCostUsd: number;
  calls:            number;
}

export interface BudgetExceededPayload {
  type:             'token' | 'cost';
  used:             number;
  limit:            number;
  calls:            number;
  estimatedCostUsd: number;
  timestamp:        number;
}
