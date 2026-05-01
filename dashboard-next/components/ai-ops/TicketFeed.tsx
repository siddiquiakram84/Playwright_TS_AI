'use client';

import { useReducer, useCallback } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { JiraTicketEvent } from '@core/ai/ops/AIEventBus';

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  devops:  { label: 'DevOps',  color: 'var(--yellow)', bg: 'rgba(245,158,11,.1)'  },
  bug:     { label: 'Bug',     color: 'var(--red)',    bg: 'rgba(239,68,68,.1)'   },
  manual:  { label: 'Manual',  color: 'var(--purple2)',bg: 'rgba(139,92,246,.1)'  },
  summary: { label: 'Summary', color: 'var(--cyan2)',  bg: 'rgba(59,130,246,.1)'  },
};

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

type Action =
  | { type: 'ADD';   ticket: JiraTicketEvent }
  | { type: 'CLEAR' };

function reducer(state: JiraTicketEvent[], action: Action): JiraTicketEvent[] {
  switch (action.type) {
    case 'ADD':   return [action.ticket, ...state].slice(0, 50);
    case 'CLEAR': return [];
    default:      return state;
  }
}

function TicketRow({ ticket }: { ticket: JiraTicketEvent }) {
  const meta = CATEGORY_META[ticket.category] ?? CATEGORY_META.summary;
  return (
    <div
      className="px-4 py-[10px] border-b animate-slide-in"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-[3px]">
        <span
          className="text-[10px] font-semibold px-[7px] py-[2px] rounded"
          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}44` }}
        >
          {meta.label}
        </span>
        <a
          href={ticket.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold text-cyan hover:underline"
        >
          {ticket.key}
        </a>
        <span className="text-[10px] text-muted ml-auto tabular-nums">{fmtTime(ticket.timestamp)}</span>
      </div>
      <p className="text-[11px] text-text2 truncate" title={ticket.summary}>
        {ticket.summary.replace(/^\[AI-AUTO\]\s*/i, '')}
      </p>
      <p className="text-[10px] text-dim mt-[2px]">
        Project: <span className="text-muted">{ticket.project}</span>
        &nbsp;·&nbsp;
        Session: <span className="font-mono text-muted">{ticket.sessionId}</span>
      </p>
    </div>
  );
}

export default function TicketFeed() {
  const [tickets, dispatch] = useReducer(reducer, []);

  const onJiraTicket = useCallback((d: unknown) => {
    dispatch({ type: 'ADD', ticket: d as JiraTicketEvent });
  }, []);

  useSSE({ 'jira:ticket': onJiraTicket }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 flex justify-between items-center px-4 py-[9px] border-b"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}
      >
        <span className="text-[11px] font-semibold tracking-[.5px] uppercase text-muted">
          Jira Tickets
        </span>
        <div className="flex items-center gap-2">
          {tickets.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-[2px] rounded"
              style={{ background: 'rgba(59,130,246,.1)', color: 'var(--cyan2)', border: '1px solid rgba(59,130,246,.2)' }}>
              {tickets.length}
            </span>
          )}
          {tickets.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'CLEAR' })}
              className="text-[10px] text-muted hover:text-text cursor-pointer"
            >
              clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim py-8">
            <span className="text-[28px] mb-2 opacity-40">🎫</span>
            <p className="text-[11px] text-muted text-center leading-[1.8]">
              Jira tickets appear here in real-time<br />
              when the AI Orchestrator pipeline runs
            </p>
          </div>
        ) : (
          tickets.map((t, i) => <TicketRow key={`${t.key}-${i}`} ticket={t} />)
        )}
      </div>
    </div>
  );
}
