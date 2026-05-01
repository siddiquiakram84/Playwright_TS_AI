import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ── Event payload types ───────────────────────────────────────────────────────

export interface LLMCallEvent {
  id:        string;
  provider:  string;
  operation: string; // 'testgen' | 'heal' | 'visual' | 'datagen' | 'record' | 'plan' | 'write' | 'validate'
  timestamp: number;
}

export interface LLMStartEvent extends LLMCallEvent {
  systemPromptLength: number;
  userMessageLength:  number;
}

export interface LLMEndEvent extends LLMCallEvent {
  latencyMs:       number;
  inputTokens:     number;
  outputTokens:    number;
  cacheHitTokens:  number;
  costUsd:         number;
  success:         boolean;
  error?:          string;
}

export interface HealingEvent {
  selector:   string;
  url:        string;
  healed?:    string;
  confidence?: number;
  success:    boolean;
  timestamp:  number;
  fromCache?: boolean;
}

export interface VisualEvent {
  name:        string;
  passed:      boolean;
  differences: number;
  summary:     string;
  timestamp:   number;
}

export interface RecorderActionEvent {
  sessionId: string;
  type:      'navigate' | 'click' | 'fill' | 'select' | 'check';
  selector?: string;
  value?:    string;
  url?:      string;
  text?:     string;
  timestamp: number;
}

export interface TestGenEvent {
  sessionId: string;
  source:    'story' | 'nl' | 'recording';
  stage:     'planning' | 'writing' | 'validating' | 'complete' | 'error';
  input?:    string;
  output?:   string;
  score?:    number;
  timestamp: number;
}

export interface AdminEvent {
  action:    'provider-changed' | 'key-updated' | 'config-changed' | 'provider-fallback'
           | 'session-reset'    | 'client-reset' | 'provider-switch';
  provider?: string;
  timestamp: number;
}

export interface BudgetExceededEvent {
  type:             'token' | 'cost';
  used:             number;
  limit:            number;
  calls:            number;
  estimatedCostUsd: number;
  timestamp:        number;
}

export type OrchestratorStepStatus = 'running' | 'done' | 'error' | 'skipped';
export type OrchestratorStep =
  | 'parse' | 'generate' | 'execute' | 'heal' | 'analyze' | 'ticket' | 'summary';

export interface OrchestratorStepEvent {
  sessionId:  string;
  step:       OrchestratorStep;
  status:     OrchestratorStepStatus;
  detail:     string;
  timestamp:  number;
}

export interface JiraTicketEvent {
  sessionId:  string;
  key:        string;
  project:    string;
  issueType:  'Task' | 'Bug';
  category:   'devops' | 'bug' | 'manual' | 'summary';
  summary:    string;
  url:        string;
  timestamp:  number;
}

// ── Event map (typed EventEmitter) ────────────────────────────────────────────

export interface AIEvents {
  'llm:start':          [event: LLMStartEvent];
  'llm:end':            [event: LLMEndEvent];
  'healing':            [event: HealingEvent];
  'visual':             [event: VisualEvent];
  'recorder:action':    [event: RecorderActionEvent];
  'testgen':            [event: TestGenEvent];
  'admin':              [event: AdminEvent];
  'budget:exceeded':    [event: BudgetExceededEvent];
  'orchestrator:step':  [event: OrchestratorStepEvent];
  'jira:ticket':        [event: JiraTicketEvent];
}

// ── Singleton event bus ───────────────────────────────────────────────────────

class AIEventBus extends EventEmitter {
  private static _instance: AIEventBus;

  // Forward URL — set once; null means dashboard not running (silent no-op)
  private readonly dashboardUrl: string;

  private constructor() {
    super();
    this.setMaxListeners(50);
    const port = process.env.AI_OPS_PORT ?? '9093';
    this.dashboardUrl = `http://localhost:${port}/api/ingest`;
  }

  static getInstance(): AIEventBus {
    if (!AIEventBus._instance) {
      AIEventBus._instance = new AIEventBus();
    }
    return AIEventBus._instance;
  }

  newCallId(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  // Forward event to the dashboard server over HTTP (fire-and-forget).
  // Works across process boundaries — if dashboard isn't running the POST
  // fails silently so test execution is never blocked or affected.
  private forward(eventName: string, data: unknown): void {
    fetch(this.dashboardUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ event: eventName, data }),
      signal:  AbortSignal.timeout(2000), // 2s max, never block a test
    }).catch(() => { /* dashboard not running — ignore */ });
  }

  emitLLMStart(event: LLMStartEvent): void {
    this.emit('llm:start', event);
    this.forward('llm:start', event);
  }

  emitLLMEnd(event: LLMEndEvent): void {
    this.emit('llm:end', event);
    this.forward('llm:end', event);
  }

  emitHealing(event: HealingEvent): void {
    this.emit('healing', event);
    this.forward('healing', event);
  }

  emitVisual(event: VisualEvent): void {
    this.emit('visual', event);
    this.forward('visual', event);
  }

  emitRecorderAction(event: RecorderActionEvent): void {
    this.emit('recorder:action', event);
    this.forward('recorder:action', event);
  }

  emitTestGen(event: TestGenEvent): void {
    this.emit('testgen', event);
    this.forward('testgen', event);
  }

  emitAdmin(event: AdminEvent): void {
    this.emit('admin', event);
    this.forward('admin', event);
  }

  emitBudgetExceeded(event: BudgetExceededEvent): void {
    this.emit('budget:exceeded', event);
    this.forward('budget:exceeded', event);
  }

  emitOrchestratorStep(event: OrchestratorStepEvent): void {
    this.emit('orchestrator:step', event);
    this.forward('orchestrator:step', event);
  }

  emitJiraTicket(event: JiraTicketEvent): void {
    this.emit('jira:ticket', event);
    this.forward('jira:ticket', event);
  }
}

export const aiEventBus = AIEventBus.getInstance();
