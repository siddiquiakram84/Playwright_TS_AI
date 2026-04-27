'use client';

import { useReducer, useCallback, useEffect } from 'react';
import type { LLMCallItem } from '@/types';

// ── Op icons ─────────────────────────────────────────────────────────────────
const OP_ICONS: Record<string, string> = {
  plan: '🗺', write: '✍', validate: '✅', datagen: '🎲',
  heal: '🔧', vision: '👁', general: '⚡', record: '🎬', write_squish: '🐍',
};

// ── State ─────────────────────────────────────────────────────────────────────
type CallMap = Record<string, LLMCallItem>;

type Action =
  | { type: 'START'; id: string; operation: string; provider: string; timestamp: number }
  | { type: 'END';   id: string; latencyMs: number; inputTokens: number; outputTokens: number;
      cacheHitTokens: number; costUsd: number; success: boolean; error?: string }
  | { type: 'SEED';  items: LLMCallItem[] };

function reducer(state: CallMap, action: Action): CallMap {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        [action.id]: {
          id: action.id, operation: action.operation, provider: action.provider,
          status: 'pending', timestamp: action.timestamp,
        },
      };
    case 'END': {
      const prev = state[action.id] ?? {
        id: action.id, operation: 'unknown', provider: 'unknown', timestamp: Date.now(),
      };
      return {
        ...state,
        [action.id]: {
          ...prev,
          status:         action.success ? 'success' : 'error',
          latencyMs:      action.latencyMs,
          inputTokens:    action.inputTokens,
          outputTokens:   action.outputTokens,
          cacheHitTokens: action.cacheHitTokens,
          costUsd:        action.costUsd,
          error:          action.error,
        },
      };
    }
    case 'SEED': {
      const seeded: CallMap = {};
      for (const item of action.items) seeded[item.id] = item;
      return { ...seeded, ...state };
    }
    default: return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

// ── Call row ──────────────────────────────────────────────────────────────────
function CallRow({ item }: { item: LLMCallItem }) {
  const isDone    = item.status !== 'pending';
  const isErr     = item.status === 'error';
  const tokens    = (item.inputTokens ?? 0) + (item.outputTokens ?? 0);
  const cached    = item.cacheHitTokens ?? 0;
  const maxLatMs  = 5_000;
  const barW      = isDone ? Math.min(100, (item.latencyMs ?? 0) / maxLatMs * 100) : 0;

  return (
    <div
      className="grid items-center gap-2 px-[14px] py-2 border-b hover:bg-[rgba(0,212,255,.03)] transition-colors animate-slide-in"
      style={{
        gridTemplateColumns: '18px 115px 80px 1fr 72px 78px',
        borderColor:         'rgba(22,52,80,.6)',
      }}
    >
      {/* Status dot */}
      <div className="flex items-center justify-center">
        <span
          className={`sdot ${item.status === 'pending' ? 'sdot-pending' : isErr ? 'sdot-error' : ''}`}
        />
      </div>

      {/* Operation */}
      <div className="text-[12px] font-bold text-text truncate">
        {OP_ICONS[item.operation] ?? '⚡'} {item.operation}
      </div>

      {/* Provider */}
      <div className="text-[11px] text-text2 truncate">{item.provider}</div>

      {/* Latency bar */}
      <div className="flex flex-col gap-[3px] min-w-0">
        {isDone ? (
          <>
            <div className="lat-bar" style={{ width: `${barW}%` }} />
            <span className="text-[10px] text-text2 flex items-center gap-[6px]">
              {item.latencyMs}ms
              {cached > 0 && (
                <span className="text-purple2 text-[10px]">⚡{fmtNum(cached)} cached</span>
              )}
            </span>
          </>
        ) : (
          <span className="text-yellow text-[11px] animate-live-pulse">⋯ running</span>
        )}
      </div>

      {/* Tokens */}
      <div className="text-[11px] text-text2 text-right">
        {isDone ? fmtNum(tokens) : '—'}
      </div>

      {/* Cost */}
      <div
        className={`text-[11px] text-right tabular-nums ${isErr ? 'text-red' : 'text-green2'}`}
        style={!isErr ? { textShadow: '0 0 6px rgba(0,232,154,.25)' } : undefined}
      >
        {isDone ? (isErr ? '❌' : `$${(item.costUsd ?? 0).toFixed(4)}`) : '—'}
      </div>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColHeaders() {
  return (
    <div
      className="flex-shrink-0 grid items-center gap-2 px-[14px] py-[7px] border-b orb text-[9px] text-dim tracking-[1px] uppercase"
      style={{ gridTemplateColumns: '18px 115px 80px 1fr 72px 78px', borderColor: 'var(--border)', background: 'rgba(0,0,0,.3)' }}
    >
      <span />
      <span>Operation</span>
      <span>Provider</span>
      <span>Latency</span>
      <span className="text-right">Tokens</span>
      <span className="text-right">Cost</span>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export type ActiveTab = 'llm' | 'testgen' | 'visual';

interface TabBarProps {
  active:   ActiveTab;
  onChange: (tab: ActiveTab) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'llm',     label: 'LLM Calls'      },
    { id: 'testgen', label: 'Test Generator'  },
    { id: 'visual',  label: 'Visual AI'       },
  ];
  return (
    <div
      className="flex-shrink-0 flex border-b"
      style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,.35)' }}
    >
      {tabs.map(t => (
        <button
          key={t.id}
          className={`tab-btn ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export interface LLMCallLogRef {
  onLLMStart: (d: unknown) => void;
  onLLMEnd:   (d: unknown) => void;
}

interface LLMCallLogProps {
  onRef?: (ref: LLMCallLogRef) => void;
}

export default function LLMCallLog({ onRef }: LLMCallLogProps) {
  const [calls, dispatch] = useReducer(reducer, {});

  // Seed with persisted history on mount
  useEffect(() => {
    fetch('/api/history?limit=30')
      .then(r => r.json())
      .then((data: { calls?: Array<Record<string, unknown>> }) => {
        if (!Array.isArray(data.calls)) return;
        const items: LLMCallItem[] = data.calls.map(c => ({
          id:             String(c['call_id'] ?? c['id'] ?? ''),
          operation:      String(c['operation'] ?? ''),
          provider:       String(c['provider'] ?? ''),
          status:         c['success'] ? 'success' : 'error',
          latencyMs:      Number(c['latency_ms'] ?? 0),
          inputTokens:    Number(c['input_tokens'] ?? 0),
          outputTokens:   Number(c['output_tokens'] ?? 0),
          cacheHitTokens: Number(c['cache_tokens'] ?? 0),
          costUsd:        Number(c['cost_usd'] ?? 0),
          timestamp:      Number(c['created_at'] ?? 0) * 1000,
        }));
        dispatch({ type: 'SEED', items });
      })
      .catch(() => { /* history not available — silent */ });
  }, []);

  const onLLMStart = useCallback((d: unknown) => {
    const e = d as { id: string; operation: string; provider: string; timestamp: number };
    dispatch({ type: 'START', id: e.id, operation: e.operation, provider: e.provider, timestamp: e.timestamp });
  }, []);

  const onLLMEnd = useCallback((d: unknown) => {
    const e = d as {
      id: string; latencyMs: number; inputTokens: number; outputTokens: number;
      cacheHitTokens: number; costUsd: number; success: boolean; error?: string;
    };
    dispatch({
      type: 'END', id: e.id, latencyMs: e.latencyMs,
      inputTokens: e.inputTokens, outputTokens: e.outputTokens,
      cacheHitTokens: e.cacheHitTokens, costUsd: e.costUsd,
      success: e.success, error: e.error,
    });
  }, []);

  // Expose handlers to parent via callback ref pattern
  useEffect(() => {
    onRef?.({ onLLMStart, onLLMEnd });
  }, [onRef, onLLMStart, onLLMEnd]);

  // Sorted newest first
  const rows = Object.values(calls).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <ColHeaders />
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim py-11">
            <span className="text-[30px] mb-3 opacity-45">⚡</span>
            <p className="orb text-[10px] tracking-[1px] text-muted text-center leading-[1.8]">
              LLM calls stream here in real-time<br />
              <span className="text-[11px] text-cyan2 font-mono mt-2 inline-block px-3 py-1 bg-surface2 border border-border2 rounded">
                npm run test:ai
              </span>
            </p>
          </div>
        ) : (
          rows.map(item => <CallRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
