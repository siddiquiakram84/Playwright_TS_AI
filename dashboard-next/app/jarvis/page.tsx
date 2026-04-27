'use client';

import { useState } from 'react';
import useSWR from 'swr';
import StatsBar   from '@/components/jarvis/StatsBar';
import TrendChart from '@/components/jarvis/TrendChart';
import type { JarvisData, SpecRow, SpecStatus } from '@/types/jarvis';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUS_COLOR: Record<SpecStatus, string> = {
  passed:   'var(--green)',
  failed:   'var(--red)',
  skipped:  'var(--muted)',
  timedOut: 'var(--orange)',
  flaky:    'var(--yellow)',
};

function fmsDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function SpecsTable({ rows, title }: { rows: SpecRow[]; title: string }) {
  return (
    <div className="flex flex-col overflow-hidden">
      <div
        className="flex-shrink-0 flex items-center px-4 py-[7px] border-b border-border"
        style={{ background: 'rgba(0,212,255,.04)' }}
      >
        <span className="orb text-[10px] font-bold tracking-[2px] uppercase text-cyan2">{title}</span>
        <span
          className="ml-2 orb text-[9px] px-[6px] py-[1px] rounded-[2px]"
          style={{ background: 'rgba(0,212,255,.1)', color: 'var(--cyan)' }}
        >
          {rows.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-dim text-[11px]">—</div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  className="border-b hover:bg-surface2 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-3 py-[5px] w-4">
                    <span
                      className="orb text-[8px] font-bold px-[5px] py-[2px] rounded-[2px]"
                      style={{ color: STATUS_COLOR[r.status], border: `1px solid ${STATUS_COLOR[r.status]}44` }}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-2 py-[5px] max-w-0 truncate text-text2" title={r.title}>{r.title}</td>
                  <td className="px-2 py-[5px] text-muted whitespace-nowrap text-right">{r.project}</td>
                  <td className="px-3 py-[5px] text-dim whitespace-nowrap text-right tabular-nums">
                    {fmsDuration(r.duration)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function JarvisPage() {
  const { data, isLoading, error } = useSWR<JarvisData>('/api/jarvis', fetcher, {
    refreshInterval: 30_000,
  });
  const [activeTab, setActiveTab] = useState<'failures' | 'slow' | 'all'>('failures');

  if (isLoading) {
    return (
      <div className="relative z-10 flex items-center justify-center flex-1 h-full">
        <span className="orb text-[11px] tracking-[2px] text-muted animate-pulse">LOADING…</span>
      </div>
    );
  }

  if (error || !data || data.status === 'error') {
    return (
      <div className="relative z-10 flex items-center justify-center flex-1 h-full">
        <span className="orb text-[11px] tracking-[1px] text-red2">
          {data?.message ?? 'Could not load results'}
        </span>
      </div>
    );
  }

  if (data.status === 'no_data') {
    return (
      <div className="relative z-10 flex items-center justify-center flex-1 h-full">
        <span className="orb text-[11px] tracking-[1px] text-muted">{data.message}</span>
      </div>
    );
  }

  const tabRows = activeTab === 'failures' ? data.failures
                : activeTab === 'slow'     ? data.slowTests
                : data.specs;

  return (
    <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center gap-4 px-5 py-[10px] border-b"
        style={{ borderColor: 'var(--border2)', background: 'rgba(0,0,0,.45)' }}
      >
        <div>
          <div className="orb text-[18px] font-black tracking-[5px] text-cyan"
               style={{ textShadow: 'var(--glow-c)' }}>
            JARVIS
          </div>
          <div className="orb text-[9px] tracking-[3px] text-muted">TEST INTELLIGENCE</div>
        </div>
        <div className="ml-auto text-[10px] text-dim orb tabular-nums">
          Last run: {new Date(data.summary.startTime).toLocaleString()}
        </div>
        <div className="text-[10px] text-dim orb">
          Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </div>
      </header>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <StatsBar summary={data.summary} />
      </div>

      {/* ── 2-column body: trend + specs ─────────────────────────────────── */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '380px 1fr' }}>
        {/* Left: trend chart */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex-shrink-0 flex items-center px-4 py-[7px] border-b border-border"
            style={{ background: 'rgba(0,212,255,.04)' }}
          >
            <span className="orb text-[10px] font-bold tracking-[2px] uppercase text-cyan2">Pass Rate Trend</span>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            <TrendChart history={data.history} />
          </div>

          {/* Project breakdown */}
          <div
            className="flex-shrink-0 border-t px-4 py-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-2">By Project</div>
            <div className="flex flex-col gap-[6px]">
              {data.projects.map(p => {
                const pct = p.total > 0 ? (p.passed / p.total) * 100 : 0;
                const color = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="orb text-[9px] text-text2 w-28 truncate">{p.name}</span>
                    <div className="flex-1 h-[4px] rounded-full overflow-hidden bg-surface3">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="orb text-[9px] tabular-nums text-muted w-8 text-right">
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: spec list with tab bar */}
        <div className="flex flex-col overflow-hidden">
          <div
            className="flex-shrink-0 flex items-center gap-1 px-4 py-[5px] border-b border-border"
            style={{ background: 'rgba(0,212,255,.04)' }}
          >
            {(['failures', 'slow', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="orb text-[9px] tracking-[1px] px-3 py-[4px] rounded-[2px] transition-all cursor-pointer"
                style={{
                  color:      activeTab === tab ? 'var(--cyan)' : 'var(--muted)',
                  background: activeTab === tab ? 'rgba(0,212,255,.1)' : 'transparent',
                  border:     `1px solid ${activeTab === tab ? 'rgba(0,212,255,.3)' : 'transparent'}`,
                }}
              >
                {tab === 'failures' ? `FAILURES (${data.failures.length})`
                 : tab === 'slow'   ? `SLOWEST (${data.slowTests.length})`
                 : `ALL (${data.specs.length})`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <SpecsTable rows={tabRows} title="" />
          </div>
        </div>
      </div>
    </div>
  );
}
