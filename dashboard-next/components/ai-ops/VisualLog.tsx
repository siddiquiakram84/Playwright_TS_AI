'use client';

import { useReducer, useCallback, useEffect } from 'react';
import type { VisualItem } from '@/types';

// ── State ─────────────────────────────────────────────────────────────────────
type Action =
  | { type: 'PUSH'; item: VisualItem }
  | { type: 'SEED'; items: VisualItem[] };

function reducer(state: VisualItem[], action: Action): VisualItem[] {
  switch (action.type) {
    case 'PUSH': return [action.item, ...state];
    case 'SEED': return [...action.items, ...state];
    default:     return state;
  }
}

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ item }: { item: VisualItem }) {
  return (
    <div
      className="grid items-center gap-2 px-[14px] py-[10px] border-b hover:bg-[rgba(255,255,255,.02)] transition-colors animate-slide-in"
      style={{
        gridTemplateColumns: '9px 1fr 70px 68px 72px',
        borderColor:         'var(--border)',
      }}
    >
      {/* Pass/fail dot */}
      <span
        className="w-[9px] h-[9px] rounded-full flex-shrink-0"
        style={{
          background: item.passed ? 'var(--green)' : 'var(--red)',
        }}
      />

      {/* Page name */}
      <div className="text-[12px] font-bold text-text truncate">{item.name}</div>

      {/* Differences */}
      <div
        className={`text-[11px] text-right tabular-nums ${item.differences > 0 ? 'text-yellow' : 'text-muted'}`}
      >
        {item.differences > 0 ? `${item.differences} diff` : '—'}
      </div>

      {/* Status tag */}
      <div className="flex justify-center">
        <span className={`tag ${item.passed ? 'tag-ok' : 'tag-err'}`}>
          {item.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      {/* Time */}
      <div className="text-[10px] text-muted text-right tabular-nums">
        {fmtTime(item.timestamp)}
      </div>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColHeaders() {
  return (
    <div
      className="flex-shrink-0 grid items-center gap-2 px-[14px] py-[7px] border-b orb text-[9px] text-dim tracking-[1px] uppercase"
      style={{
        gridTemplateColumns: '9px 1fr 70px 68px 72px',
        borderColor:         'var(--border)',
        background:          'var(--surface2)',
      }}
    >
      <span />
      <span>Page / Test</span>
      <span className="text-right">Diffs</span>
      <span className="text-center">Result</span>
      <span className="text-right">Time</span>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ items }: { items: VisualItem[] }) {
  if (items.length === 0) return null;
  const passed = items.filter(i => i.passed).length;
  const pct    = Math.round((passed / items.length) * 100);

  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 px-[14px] py-[7px] border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
    >
      <div className="flex-1 h-[3px] bg-surface3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width:      `${pct}%`,
            background: pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)',
          }}
        />
      </div>
      <span className="orb text-[10px] tabular-nums flex-shrink-0"
        style={{ color: pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)' }}
      >
        {passed}/{items.length} passed
      </span>
    </div>
  );
}

// ── Public ref type ───────────────────────────────────────────────────────────
export interface VisualLogRef {
  onVisual: (d: unknown) => void;
}

interface Props {
  onRef?: (ref: VisualLogRef) => void;
}

export default function VisualLog({ onRef }: Props) {
  const [items, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    fetch('/api/history?type=visual&limit=30')
      .then(r => r.json())
      .then((data: { visual?: Array<Record<string, unknown>> }) => {
        if (!Array.isArray(data.visual)) return;
        const mapped: VisualItem[] = data.visual.map(r => ({
          name:        String(r['page_name'] ?? r['name'] ?? ''),
          passed:      r['status'] === 'pass' || Boolean(r['passed']),
          differences: Number(r['differences'] ?? 0),
          summary:     String(r['summary']     ?? ''),
          timestamp:   Number(r['created_at']  ?? 0) * 1000,
        }));
        dispatch({ type: 'SEED', items: mapped });
      })
      .catch(() => null);
  }, []);

  const onVisual = useCallback((d: unknown) => {
    dispatch({ type: 'PUSH', item: d as VisualItem });
  }, []);

  useEffect(() => { onRef?.({ onVisual }); }, [onRef, onVisual]);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <SummaryBar items={items} />
      <ColHeaders />
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim py-11">
            <span className="text-[30px] mb-3 opacity-45">👁</span>
            <p className="orb text-[10px] tracking-[1px] text-muted text-center leading-[1.8]">
              Visual AI results appear here<br />
              <span className="text-[11px] text-cyan2 font-mono mt-2 inline-block px-3 py-1 bg-surface2 border border-border2 rounded">
                npm run test:responsive
              </span>
            </p>
          </div>
        ) : (
          items.map((item, i) => <ResultRow key={`${item.name}-${i}`} item={item} />)
        )}
      </div>
    </div>
  );
}
