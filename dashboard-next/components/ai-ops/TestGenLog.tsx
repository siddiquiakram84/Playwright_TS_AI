'use client';

import { useReducer, useCallback, useEffect, useState } from 'react';
import type { TestGenItem, GenStage } from '@/types';

// ── Stage metadata ─────────────────────────────────────────────────────────────
const STAGE_META: Record<GenStage, { icon: string; color: string; label: string }> = {
  planning:   { icon: '🗺',  color: 'var(--cyan)',    label: 'Planning'   },
  writing:    { icon: '✍',  color: 'var(--purple2)',  label: 'Writing'    },
  validating: { icon: '🔍', color: 'var(--yellow)',   label: 'Validating' },
  complete:   { icon: '✓',  color: 'var(--green)',    label: 'Complete'   },
  error:      { icon: '✗',  color: 'var(--red)',      label: 'Error'      },
};

const STAGE_ORDER: GenStage[] = ['planning', 'writing', 'validating', 'complete'];

// ── State ──────────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCode(events: TestGenItem[]): string | undefined {
  // Look for code in complete or writing stages (writer outputs TS code)
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.output && (e.stage === 'complete' || e.stage === 'writing')) {
      return e.output;
    }
  }
  // Fall back to any output
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].output) return events[i].output;
  }
  return undefined;
}

function getError(events: TestGenItem[]): string | undefined {
  const err = events.find(e => e.stage === 'error');
  return err?.output;
}

function tsAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)   return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

// ── Session sidebar row ────────────────────────────────────────────────────────
function SessionRow({
  events,
  selected,
  onClick,
}: {
  events:   TestGenItem[];
  selected: boolean;
  onClick:  () => void;
}) {
  const first  = events[0];
  const last   = events[events.length - 1];
  const meta   = STAGE_META[last.stage];
  const isDone = last.stage === 'complete' || last.stage === 'error';

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-[10px] border-b transition-all cursor-pointer"
      style={{
        borderColor: 'var(--border)',
        background:  selected ? 'rgba(0,212,255,.08)' : 'transparent',
        borderLeft:  selected ? `3px solid var(--cyan)` : '3px solid transparent',
      }}
    >
      {/* Source + time */}
      <div className="flex items-center gap-2 mb-[5px]">
        <span className="orb text-[11px] font-bold text-text2 truncate flex-1 uppercase">
          {first.source}
        </span>
        <span className="text-[10px] text-dim tabular-nums flex-shrink-0">{tsAgo(first.timestamp)}</span>
      </div>

      {/* Stage pipeline dots */}
      <div className="flex items-center gap-1 mb-[4px]">
        {STAGE_ORDER.map((s, i) => {
          const reached = events.some(e => e.stage === s);
          const isCur   = s === last.stage && !isDone;
          const sm      = STAGE_META[s];
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className="h-px w-4 transition-all duration-500"
                  style={{ background: reached ? sm.color : 'var(--border)' }}
                />
              )}
              <span
                className={`text-[10px] ${isCur ? 'animate-live-pulse' : ''}`}
                style={{ color: reached ? sm.color : 'var(--dim)', opacity: reached ? 1 : 0.35 }}
                title={sm.label}
              >
                {sm.icon}
              </span>
            </div>
          );
        })}
        {last.stage === 'error' && (
          <span className="text-[10px] text-red ml-2">✗</span>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className="orb text-[9px] px-[6px] py-[2px] rounded"
          style={{
            color:      meta.color,
            background: `${meta.color}18`,
            border:     `1px solid ${meta.color}35`,
          }}
        >
          {meta.label.toUpperCase()}
        </span>
        {isDone && last.score !== undefined && (
          <span className="orb text-[9px] text-green2 tabular-nums">Score: {last.score}/10</span>
        )}
      </div>
    </button>
  );
}

// ── Code viewer ────────────────────────────────────────────────────────────────
function CodeViewer({ events }: { events: TestGenItem[] | null }) {
  const [copied, setCopied] = useState(false);

  if (!events) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-dim">
        <div className="text-[48px] opacity-20">{'{ }'}</div>
        <p className="orb text-[12px] tracking-[1px] text-muted text-center leading-[2]">
          Select a session to view generated code
        </p>
      </div>
    );
  }

  const last  = events[events.length - 1];
  const code  = getCode(events);
  const err   = getError(events);
  const meta  = STAGE_META[last.stage];
  const first = events[0];

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Viewer header */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-[9px] border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
      >
        <span className="orb text-[12px] font-bold text-text2 uppercase">{first.source}</span>
        <span
          className="orb text-[10px] px-[7px] py-[2px] rounded"
          style={{
            color:      meta.color,
            background: `${meta.color}18`,
            border:     `1px solid ${meta.color}35`,
          }}
        >
          {meta.label}
        </span>
        {last.score !== undefined && (
          <span className="orb text-[10px] text-green2 tabular-nums">Score: {last.score}/10</span>
        )}
        <span className="text-[10px] text-dim tabular-nums ml-auto">
          {new Date(first.timestamp).toLocaleString()}
        </span>
        {code && (
          <button
            onClick={copyCode}
            className="orb text-[11px] px-3 py-[5px] rounded transition-all cursor-pointer"
            style={{
              color:      copied ? 'var(--green)' : 'var(--cyan)',
              background: copied ? 'rgba(0,232,154,.1)' : 'rgba(0,212,255,.08)',
              border:     `1px solid ${copied ? 'rgba(0,232,154,.3)' : 'rgba(0,212,255,.25)'}`,
            }}
          >
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        )}
      </div>

      {/* Stage pipeline bar */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-[7px] border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,.25)' }}
      >
        {STAGE_ORDER.map((s, i) => {
          const reached = events.some(e => e.stage === s);
          const isCur   = s === last.stage && last.stage !== 'complete' && last.stage !== 'error';
          const sm      = STAGE_META[s];
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className="h-px w-8 transition-all duration-700"
                  style={{ background: reached ? sm.color : 'var(--border)' }}
                />
              )}
              <div className="flex items-center gap-1">
                <span
                  className={`text-[13px] ${isCur ? 'animate-live-pulse' : ''}`}
                  style={{ color: reached ? sm.color : 'var(--dim)', opacity: reached ? 1 : 0.3 }}
                >
                  {sm.icon}
                </span>
                <span
                  className="orb text-[10px]"
                  style={{ color: reached ? sm.color : 'var(--dim)', opacity: reached ? 0.8 : 0.3 }}
                >
                  {sm.label}
                </span>
              </div>
            </div>
          );
        })}
        {last.stage === 'error' && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[13px] text-red">✗</span>
            <span className="orb text-[10px] text-red">Error</span>
          </div>
        )}
      </div>

      {/* Code / error content */}
      <div className="flex-1 overflow-auto">
        {err && (
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <pre
              className="text-[12px] text-red2 font-mono whitespace-pre-wrap leading-relaxed rounded p-3"
              style={{ background: 'rgba(255,68,68,.06)', border: '1px solid rgba(255,68,68,.2)' }}
            >
              {err}
            </pre>
          </div>
        )}
        {code ? (
          <pre
            className="text-[12px] font-mono leading-relaxed p-5 overflow-x-auto"
            style={{ color: 'var(--text2)', background: 'transparent' }}
          >
            <code>{code}</code>
          </pre>
        ) : (
          !err && (
            <div className="flex items-center justify-center h-full gap-3 text-dim py-12">
              <span className="animate-spin text-[18px]">⟳</span>
              <span className="orb text-[12px] text-muted animate-pulse">Generating…</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Public ref type ────────────────────────────────────────────────────────────
export interface TestGenLogRef {
  onTestGen: (d: unknown) => void;
}

interface Props {
  onRef?: (ref: TestGenLogRef) => void;
}

export default function TestGenLog({ onRef }: Props) {
  const [sessions, dispatch]         = useReducer(reducer, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    // Auto-select the incoming session
    if (e.stage === 'planning') setSelectedId(e.sessionId);
  }, []);

  useEffect(() => { onRef?.({ onTestGen }); }, [onRef, onTestGen]);

  const sessionList = Object.values(sessions)
    .sort((a, b) => b[0].timestamp - a[0].timestamp);

  const selectedEvents = selectedId ? (sessions[selectedId] ?? null) : null;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Session sidebar ──────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden border-r"
        style={{ width: 220, borderColor: 'var(--border)' }}
      >
        {/* Sidebar header */}
        <div
          className="flex-shrink-0 flex items-center px-3 py-[9px] border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
        >
          <span className="orb text-[10px] tracking-[1.5px] text-dim uppercase">Sessions</span>
          <span
            className="ml-auto orb text-[9px] px-[6px] py-[1px] rounded"
            style={{ background: 'rgba(0,212,255,.1)', color: 'var(--cyan)' }}
          >
            {sessionList.length}
          </span>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
              <span className="text-[28px] opacity-25">✍</span>
              <p className="orb text-[10px] text-muted text-center leading-[1.8] px-3">
                Sessions appear here when the AI pipeline runs
              </p>
            </div>
          ) : (
            sessionList.map(events => (
              <SessionRow
                key={events[0].sessionId}
                events={events}
                selected={selectedId === events[0].sessionId}
                onClick={() => setSelectedId(events[0].sessionId)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Code viewer ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <CodeViewer events={selectedEvents} />
      </div>

    </div>
  );
}
