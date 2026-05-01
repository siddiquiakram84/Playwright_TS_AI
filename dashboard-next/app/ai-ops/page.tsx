'use client';

import { useState, useCallback, useRef } from 'react';
import Header from '@/components/ai-ops/Header';
import Panel from '@/components/ui/Panel';
import LLMCallLog, {
  TabBar,
  type ActiveTab,
  type LLMCallLogRef,
} from '@/components/ai-ops/LLMCallLog';
import TestGenLog, { type TestGenLogRef } from '@/components/ai-ops/TestGenLog';
import VisualLog,   { type VisualLogRef }   from '@/components/ai-ops/VisualLog';
import ConfigPanel        from '@/components/ai-ops/ConfigPanel';
import RecorderPanel      from '@/components/ai-ops/RecorderPanel';
import OrchestratorPanel  from '@/components/ai-ops/OrchestratorPanel';
import TicketFeed         from '@/components/ai-ops/TicketFeed';
import BudgetModal        from '@/components/ai-ops/BudgetModal';
import { useMetrics } from '@/hooks/useMetrics';
import { useSSE }     from '@/hooks/useSSE';
import type { BudgetExceededPayload, BudgetState, SessionMetrics } from '@/types';

const INIT_BUDGET: BudgetState = {
  tokenLimit: 0, costLimitUsd: 0,
  totalTokens: 0, estimatedCostUsd: 0, calls: 0,
};

export default function AiOpsPage() {
  const { metrics, totalTokens, push: pushMetrics } = useMetrics();

  const [connected,      setConnected]      = useState(false);
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('llm');
  const [provider,       setProvider]       = useState(
    process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'anthropic',
  );
  const [budget,         setBudget]         = useState<BudgetState>(INIT_BUDGET);
  const [budgetExceeded, setBudgetExceeded] = useState<BudgetExceededPayload | null>(null);

  const llmRef     = useRef<LLMCallLogRef | null>(null);
  const testGenRef = useRef<TestGenLogRef | null>(null);
  const visualRef  = useRef<VisualLogRef  | null>(null);

  const onLLMStart = useCallback((d: unknown) => llmRef.current?.onLLMStart(d), []);
  const onLLMEnd   = useCallback((d: unknown) => llmRef.current?.onLLMEnd(d),   []);
  const onTestGen  = useCallback((d: unknown) => testGenRef.current?.onTestGen(d), []);
  const onVisual   = useCallback((d: unknown) => visualRef.current?.onVisual(d),   []);

  const onMetrics = useCallback((d: unknown) => {
    const m = d as SessionMetrics;
    pushMetrics(m);
    setBudget(prev => ({
      ...prev,
      totalTokens:      m.inputTokens + m.outputTokens,
      estimatedCostUsd: m.estimatedCostUsd,
      calls:            m.calls,
    }));
  }, [pushMetrics]);

  const onAdmin = useCallback((d: unknown) => {
    const a = d as { provider?: string };
    if (a.provider) setProvider(a.provider);
  }, []);

  const onBudgetExceeded = useCallback((d: unknown) => {
    setBudgetExceeded(d as BudgetExceededPayload);
  }, []);

  const onOpen  = useCallback(() => setConnected(true),  []);
  const onClose = useCallback(() => setConnected(false), []);

  useSSE(
    {
      'llm-start':       onLLMStart,
      'llm-end':         onLLMEnd,
      'testgen':         onTestGen,
      'visual':          onVisual,
      'metrics':         onMetrics,
      'admin':           onAdmin,
      'budget:exceeded': onBudgetExceeded,
    },
    { onOpen, onClose },
  );

  const costMax = budget.costLimitUsd > 0
    ? budget.costLimitUsd
    : Math.max(0.01, metrics.estimatedCostUsd * 2);
  const costPct = Math.min(100, (metrics.estimatedCostUsd / costMax) * 100);

  return (
    <div className="relative z-10 flex flex-col h-screen overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Header
        metrics={metrics}
        totalTokens={totalTokens}
        connected={connected}
        provider={provider}
      />

      {/* ── 4-column main grid ─────────────────────────────────────────────── */}
      <main className="flex-1 grid overflow-hidden" style={{
        gridTemplateColumns: 'minmax(220px,260px) minmax(320px,1fr) minmax(240px,280px) minmax(260px,300px)',
        minWidth: 0,
      }}>

        {/* Col 1 — Config */}
        <Panel>
          <ConfigPanel
            budget={budget}
            provider={provider}
            onBudgetUpdate={setBudget}
          />
        </Panel>

        {/* Col 2 — Log tabs */}
        <Panel className="border-x border-border">
          <TabBar active={activeTab} onChange={setActiveTab} />
          <div className={activeTab === 'llm'     ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
            <LLMCallLog onRef={ref => { llmRef.current = ref; }} />
          </div>
          <div className={activeTab === 'testgen' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
            <TestGenLog onRef={ref => { testGenRef.current = ref; }} />
          </div>
          <div className={activeTab === 'visual'  ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
            <VisualLog  onRef={ref => { visualRef.current  = ref; }} />
          </div>
        </Panel>

        {/* Col 3 — AI Orchestrator */}
        <Panel className="border-r border-border">
          <OrchestratorPanel />
        </Panel>

        {/* Col 4 — Ticket feed (top) + Test generator (bottom) */}
        <Panel>
          {/* Use a proper flex column with explicit flex-basis so neither child
              uses a height% that fights against the flex container */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="overflow-hidden border-b border-border" style={{ flex: '1 1 0', minHeight: 0 }}>
              <TicketFeed />
            </div>
            <div className="overflow-hidden" style={{ flex: '0 0 44%' }}>
              <RecorderPanel />
            </div>
          </div>
        </Panel>
      </main>

      {/* ── Footer cost bar ────────────────────────────────────────────────── */}
      <footer
        className="flex-shrink-0 flex items-center gap-4 px-5 py-[7px] border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <span className="text-[9px] font-semibold tracking-[1.5px] text-muted uppercase flex-shrink-0">
          Session Cost
        </span>
        <div className="flex-1 h-[4px] bg-surface3 rounded-full overflow-hidden">
          <div
            className="h-full cost-shimmer rounded-full transition-all duration-700"
            style={{ width: `${costPct}%` }}
          />
        </div>
        <span className="text-[12px] font-semibold text-cyan tabular-nums flex-shrink-0 font-mono">
          ${metrics.estimatedCostUsd.toFixed(4)}
        </span>
        {budget.costLimitUsd > 0 && (
          <span className="text-[10px] text-muted flex-shrink-0">
            / ${budget.costLimitUsd.toFixed(2)} limit
          </span>
        )}
        <span className="text-[10px] text-dim flex-shrink-0 tabular-nums">
          {metrics.calls} calls · {(totalTokens / 1000).toFixed(1)}K tokens
        </span>
      </footer>

      {budgetExceeded && (
        <BudgetModal
          payload={budgetExceeded}
          onReset={() => setBudgetExceeded(null)}
        />
      )}
    </div>
  );
}
