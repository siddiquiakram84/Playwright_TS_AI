'use client';

import { useReducer, useCallback, useEffect } from 'react';
import type { TestGenItem, GenStage } from '@/types';

// ── Stage metadata ────────────────────────────────────────────────────────────
const STAGE_META: Record<GenStage, { icon: string; color: string; label: string }> = {
  planning:   { icon: '🗺', color: 'var(--cyan)',   label: 'Planning'   },
  writing:    { icon: '✍', color: 'var(--purple2)', label: 'Writing'    },
  validating: { icon: '✅', color: 'var(--yellow)',  label: 'Validating' },
  complete:   { icon: '✓', color: 'var(--green)',   label: 'Complete'   },
  error:      { icon: '✗', color: 'var(--red)',     label: 'Error'      },
};

const STAGE_ORDER: GenStage[] = ['planning', 'writing', 'validating', 'complete'];

// ── State ─────────────────────────────────────────────────────────────────────
type SessionMap = Record<string, TestGenItem[]>;

type Action =
  | { type: 'EVENT'; item: TestGenItem }
  | { type: 'SEED';  items: TestGenItem[] };

function reducer(state: SessionMap, action: Action): SessionMap {
  switch (action.type) {
    case 'EVENT': {
      const existing = state[action.item.sessionId] ?? [];
      return { ...state, [action.item.sessionId]: [...existing, action.item] };
    }
    case 'SEED': {
      const seeded: SessionMap = {};
      for (const item of action.items) {
        seeded[item.sessionId] = [...(seeded[item.sessionId] ?? []), item];
      }
      return { ...seeded, ...state };
    }
    default: return state;
  }
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ events }: { events: TestGenItem[] }) {
  const first   = events[0];
  const last    = events[events.length - 1];
  const stage   = last.stage;
  const meta    = STAGE_META[stage];
  const isDone  = stage === 'complete' || stage === 'error';

  return (
    <div
      className="px-[14px] py-3 border-b animate-slide-in"
      style={{ borderColor: 'rgba(22,52,80,.6)' }}
    >
      {/* Row header */}
      <div className="flex items-center gap-2 mb-[6px]">
        <span style={{ color: meta.color, fontSize: 13 }}>{meta.icon}</span>
        <span className="orb text-[10px] font-bold tracking-[1px] text-text truncate flex-1">
          {first.source.toUpperCase()}
        </span>
        <span
          className="tag text-[9px] px-[7px] py-[2px]"
          style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}38` }}
        >
          {meta.label}
        </span>
        <span className="text-[10px] text-muted tabular-nums flex-shrink-0">
          {new Date(first.timestamp).toISOString().slice(11, 19)}
        </span>
      </div>

      {/* Stage pipeline */}
      <div className="flex items-center gap-1 mb-[6px]">
        {STAGE_ORDER.map((s, i) => {
          const idx = events.findIndex(e => e.stage === s);
          const reached = idx >= 0;
          const isCur   = s === stage && !isDone;
          const sm      = STAGE_META[s];
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className="h-px w-6 transition-all duration-500"
                  style={{ background: reached ? sm.color : 'var(--border)' }}
                />
              )}
              <span
                className={`text-[11px] transition-all ${isCur ? 'animate-live-pulse' : ''}`}
                style={{ color: reached ? sm.color : 'var(--dim)', opacity: reached ? 1 : 0.4 }}
                title={sm.label}
              >
                {sm.icon}
              </span>
            </div>
          );
        })}
        {stage === 'error' && (
          <span className="text-[10px] text-red ml-2">✗ Error</span>
        )}
        {isDone && last.score !== undefined && (
          <span className="text-[10px] text-green2 ml-auto tabular-nums">
            Score: {last.score}/10
          </span>
        )}
      </div>

      {/* Output preview */}
      {last.output && isDone && (
        <div
          className="text-[10px] text-text2 font-mono rounded px-2 py-1 mt-1 truncate"
          style={{ background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.1)' }}
        >
          {last.output.slice(0, 120)}{last.output.length > 120 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

// ── Column headers ────────────────────────────────────────────────────────────
function ColHeaders() {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-2 px-[14px] py-[7px] border-b orb text-[9px] text-dim tracking-[1px] uppercase"
      style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,.3)' }}
    >
      <span className="flex-shrink-0 w-4" />
      <span className="flex-1">Source / Session</span>
      <span>Stage</span>
      <span className="w-16 text-right">Score</span>
    </div>
  );
}

// ── Public ref type ───────────────────────────────────────────────────────────
export interface TestGenLogRef {
  onTestGen: (d: unknown) => void;
}

interface Props {
  onRef?: (ref: TestGenLogRef) => void;
}

export default function TestGenLog({ onRef }: Props) {
  const [sessions, dispatch] = useReducer(reducer, {});

  useEffect(() => {
    fetch('/api/history?type=testgen&limit=20')
      .then(r => r.json())
      .then((data: { testgen?: Array<Record<string, unknown>> }) => {
        if (!Array.isArray(data.testgen)) return;
        const items: TestGenItem[] = data.testgen.map(r => ({
          sessionId: String(r['session_id'] ?? ''),
          source:    String(r['source']     ?? 'story'),
          stage:     (r['stage'] as GenStage) ?? 'complete',
          input:     r['input']  ? String(r['input'])  : undefined,
          output:    r['output'] ? String(r['output']) : undefined,
          score:     r['score']  != null ? Number(r['score']) : undefined,
          timestamp: Number(r['created_at'] ?? 0) * 1000,
        }));
        dispatch({ type: 'SEED', items });
      })
      .catch(() => null);
  }, []);

  const onTestGen = useCallback((d: unknown) => {
    const e = d as TestGenItem;
    dispatch({ type: 'EVENT', item: e });
  }, []);

  useEffect(() => { onRef?.({ onTestGen }); }, [onRef, onTestGen]);

  const sessionList = Object.values(sessions)
    .sort((a, b) => b[0].timestamp - a[0].timestamp);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <ColHeaders />
      <div className="flex-1 overflow-y-auto">
        {sessionList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim py-11">
            <span className="text-[30px] mb-3 opacity-45">✍</span>
            <p className="orb text-[10px] tracking-[1px] text-muted text-center leading-[1.8]">
              Test generation events stream here<br />
              <span className="text-[11px] text-cyan2 font-mono mt-2 inline-block px-3 py-1 bg-surface2 border border-border2 rounded">
                npm run test:ai
              </span>
            </p>
          </div>
        ) : (
          sessionList.map(events => (
            <SessionCard key={events[0].sessionId} events={events} />
          ))
        )}
      </div>
    </div>
  );
}
