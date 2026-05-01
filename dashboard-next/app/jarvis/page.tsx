'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import HUDPieChart from '@/components/jarvis/HUDPieChart';
import type { JarvisData, SpecRow, SpecStatus, HistoryPoint, AIPipelineSession } from '@/types/jarvis';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmsDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function timeAgo(epochSec: number): string {
  const diff = Date.now() / 1000 - epochSec;
  if (diff < 60)     return `${Math.round(diff)}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';
type TestTab   = 'all' | 'failures' | 'slowest';

const STATUS_COLOR: Record<SpecStatus, string> = {
  passed:   'var(--green)',
  failed:   'var(--red)',
  skipped:  'var(--muted)',
  timedOut: 'var(--orange)',
  flaky:    'var(--yellow)',
};

const STATUS_BG: Record<SpecStatus, string> = {
  passed:   'rgba(0,232,154,.1)',
  failed:   'rgba(255,61,90,.1)',
  skipped:  'rgba(136,136,136,.1)',
  timedOut: 'rgba(255,165,0,.1)',
  flaky:    'rgba(255,204,0,.1)',
};

// ── Components ─────────────────────────────────────────────────────────────────

function StatCard({
  value, label, color = 'var(--cyan)', sub,
}: { value: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-3 px-2 rounded border"
      style={{ background: 'rgba(0,0,0,.35)', borderColor: 'var(--border2)' }}
    >
      <div
        className="orb text-[22px] font-black tabular-nums leading-none"
        style={{ color, textShadow: `0 0 10px ${color}55` }}
      >
        {value}
      </div>
      <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mt-[4px]">{label}</div>
      {sub && <div className="orb text-[9px] text-dim mt-[2px]">{sub}</div>}
    </div>
  );
}

function ReportBtn({
  href, label, ready, icon,
}: { href: string; label: string; ready: boolean; icon: string }) {
  if (!ready) {
    return (
      <span
        className="orb text-[10px] px-3 py-[5px] rounded flex items-center gap-1 opacity-40 cursor-not-allowed"
        style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        title="Report not generated yet"
      >
        {icon} {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="orb text-[10px] font-bold px-3 py-[5px] rounded flex items-center gap-1 transition-all"
      style={{
        color:      'var(--cyan)',
        background: 'rgba(0,212,255,.08)',
        border:     '1px solid rgba(0,212,255,.3)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,.18)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,.08)')}
    >
      {icon} {label} ↗
    </a>
  );
}

function SpecTable({ rows }: { rows: SpecRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-20 text-dim text-[12px]">No records</div>;
  }

  return (
    <table className="w-full border-collapse text-[11px]">
      <thead className="sticky top-0 z-10" style={{ background: 'var(--surface2)' }}>
        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
          <th className="px-3 py-[7px] text-left orb text-[9px] tracking-[1.5px] text-dim uppercase w-[90px]">Status</th>
          <th className="px-2 py-[7px] text-left orb text-[9px] tracking-[1.5px] text-dim uppercase">Test</th>
          <th className="px-2 py-[7px] text-left orb text-[9px] tracking-[1.5px] text-dim uppercase w-24 hidden md:table-cell">Project</th>
          <th className="px-3 py-[7px] text-right orb text-[9px] tracking-[1.5px] text-dim uppercase w-14">Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <React.Fragment key={r.id}>
            <tr
              className="border-b transition-colors hover:bg-surface2 cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            >
              <td className="px-3 py-[6px]">
                <span
                  className="orb text-[8px] font-bold px-[6px] py-[2px] rounded"
                  style={{
                    color:      STATUS_COLOR[r.status],
                    background: STATUS_BG[r.status],
                    border:     `1px solid ${STATUS_COLOR[r.status]}44`,
                  }}
                >
                  {r.status === 'timedOut' ? 'TIMEOUT' : r.status.toUpperCase()}
                </span>
              </td>
              <td className="px-2 py-[6px] text-text2 leading-snug">
                <div className="truncate max-w-[260px]" title={r.title}>{r.title}</div>
                <div className="text-[10px] text-dim font-mono truncate max-w-[260px] opacity-60">{r.file}</div>
              </td>
              <td className="px-2 py-[6px] text-muted whitespace-nowrap hidden md:table-cell">{r.project}</td>
              <td className="px-3 py-[6px] text-dim tabular-nums text-right whitespace-nowrap">{fmsDuration(r.duration)}</td>
            </tr>
            {expanded === r.id && r.error && (
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <td colSpan={4} className="px-3 py-2">
                  <pre
                    className="text-[10px] text-red2 font-mono whitespace-pre-wrap leading-relaxed rounded p-2 overflow-x-auto"
                    style={{ background: 'rgba(255,61,90,.06)', border: '1px solid rgba(255,61,90,.2)' }}
                  >
                    {r.error}
                  </pre>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

function PipelineTable({ sessions }: { sessions: AIPipelineSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-20 gap-2 text-dim text-[11px]">
        <span className="opacity-30 text-[20px]">✍</span>
        <span>No pipeline runs yet</span>
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead className="sticky top-0 z-10" style={{ background: 'var(--surface2)' }}>
        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
          <th className="px-3 py-[6px] text-left orb text-[9px] tracking-[1px] text-dim uppercase">Type</th>
          <th className="px-2 py-[6px] text-left orb text-[9px] tracking-[1px] text-dim uppercase">Status</th>
          <th className="px-2 py-[6px] text-center orb text-[9px] tracking-[1px] text-dim uppercase">Tests</th>
          <th className="px-2 py-[6px] text-center orb text-[9px] tracking-[1px] text-dim uppercase">Score</th>
          <th className="px-3 py-[6px] text-right orb text-[9px] tracking-[1px] text-dim uppercase">When</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map(s => {
          const statusColor = s.status === 'complete' ? 'var(--green)'
                            : s.status === 'error'    ? 'var(--red)'
                            : 'var(--yellow)';
          return (
            <tr key={s.sessionId} className="border-b hover:bg-surface2 transition-colors" style={{ borderColor: 'var(--border)' }}>
              <td className="px-3 py-[6px] text-text2 uppercase font-mono">{s.inputType}</td>
              <td className="px-2 py-[6px]">
                <span
                  className="orb text-[8px] font-bold px-[6px] py-[2px] rounded"
                  style={{ color: statusColor, border: `1px solid ${statusColor}44`, background: `${statusColor}10` }}
                >
                  {s.status.toUpperCase()}
                </span>
              </td>
              <td className="px-2 py-[6px] text-center text-muted tabular-nums">{s.testCount || '—'}</td>
              <td className="px-2 py-[6px] text-center tabular-nums" style={{ color: s.qualityScore > 0 ? 'var(--green)' : 'var(--dim)' }}>
                {s.qualityScore > 0 ? `${s.qualityScore}/10` : '—'}
              </td>
              <td className="px-3 py-[6px] text-right text-dim whitespace-nowrap">{timeAgo(s.createdAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Period stats from filtered history ─────────────────────────────────────────
// ── Main page ──────────────────────────────────────────────────────────────────
export default function JarvisPage() {
  const { data, isLoading, error, mutate } = useSWR<JarvisData>('/api/jarvis', fetcher, {
    refreshInterval: 30_000,
  });
  const [range, setRange]         = useState<TimeRange>('all');
  const [testTab, setTestTab]     = useState<TestTab>('failures');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  }

  // ── Filter history by time range ─────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    const now = Date.now();
    const cutoff: number = range === 'today' ? now - 86_400_000
                         : range === 'week'  ? now - 7  * 86_400_000
                         : range === 'month' ? now - 30 * 86_400_000
                         : 0;
    return data.history.filter(h => new Date(h.recordedAt).getTime() >= cutoff);
  }, [data, range]);

  // ── Aggregate passed/failed/skipped/flaky across filtered history ─────────────
  const pieData = useMemo(() => {
    const runs = filteredHistory.length;
    if (runs === 0 && data) {
      // No history in range → fall back to current run
      return {
        passed:  data.summary.passed,
        failed:  data.summary.failed,
        skipped: data.summary.skipped,
        flaky:   data.summary.flaky,
        runs:    1,
      };
    }
    return {
      passed:  filteredHistory.reduce((s, h) => s + h.passed,  0),
      failed:  filteredHistory.reduce((s, h) => s + h.failed,  0),
      skipped: filteredHistory.reduce((s, h) => s + h.skipped, 0),
      flaky:   filteredHistory.reduce((s, h) => s + h.flaky,   0),
      runs,
    };
  }, [filteredHistory, data]);

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="relative z-10 flex items-center justify-center flex-1 h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan animate-spin" style={{ borderTopColor: 'transparent' }} />
          <span className="orb text-[11px] tracking-[3px] text-cyan animate-pulse">LOADING</span>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (error || !data || data.status === 'error') {
    return (
      <div className="relative z-10 flex items-center justify-center flex-1 h-full">
        <span className="orb text-[13px] tracking-[1px] text-red2">{data?.message ?? 'Could not load results'}</span>
      </div>
    );
  }

  // ── No data state ─────────────────────────────────────────────────────────────
  if (data.status === 'no_data') {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 h-full gap-4">
        <span className="text-[48px] opacity-20">🎯</span>
        <span className="orb text-[13px] tracking-[2px] text-muted">{data.message}</span>
        <div className="flex items-center gap-3">
          <ReportBtn href="/allure"    label="Allure Report"    icon="📊" ready={data.reports?.allureReady}   />
          <ReportBtn href="/pw-report" label="Playwright Report" icon="🎭" ready={data.reports?.pwReportReady} />
        </div>
      </div>
    );
  }

  const { summary, projects, specs, failures, slowTests, pipeline, reports } = data;
  const rateColor  = summary.passRate >= 90 ? 'var(--green)' : summary.passRate >= 70 ? 'var(--yellow)' : 'var(--red)';
  const testRows   = testTab === 'failures' ? failures : testTab === 'slowest' ? slowTests : specs;
  const pipelineRows: AIPipelineSession[] = Array.isArray(pipeline)
    ? (pipeline as unknown[]).map((r: unknown) => {
        const p = r as Record<string, unknown>;
        return {
          sessionId:    String(p['session_id']    ?? p['sessionId']    ?? ''),
          inputType:    String(p['input_type']     ?? p['inputType']    ?? 'story'),
          status:       String(p['status']         ?? 'pending'),
          testCount:    Number(p['test_count']     ?? p['testCount']    ?? 0),
          qualityScore: Number(p['quality_score']  ?? p['qualityScore'] ?? 0),
          filename:     p['filename'] ? String(p['filename']) : undefined,
          createdAt:    Number(p['created_at']     ?? p['createdAt']    ?? 0),
          error:        p['error'] ? String(p['error']) : undefined,
        };
      })
    : [];

  return (
    <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-5 py-[9px] border-b"
        style={{ borderColor: 'var(--border2)', background: 'rgba(0,0,0,.5)' }}
      >
        {/* Title */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div>
            <div className="orb text-[18px] font-black tracking-[5px] text-cyan leading-none" style={{ textShadow: 'var(--glow-c)' }}>
              JARVIS
            </div>
            <div className="orb text-[7px] tracking-[2.5px] text-muted">PLAYWRIGHT INTELLIGENCE SYSTEM</div>
          </div>
          {/* LIVE badge */}
          <div
            className="flex items-center gap-[5px] px-2 py-[3px] rounded-sm flex-shrink-0"
            style={{ background: 'rgba(0,232,154,.08)', border: '1px solid rgba(0,232,154,.25)' }}
          >
            <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
            <span className="orb text-[7px] text-green tracking-[1.5px]">LIVE</span>
          </div>
        </div>

        {/* Report links */}
        <div className="flex items-center gap-2 ml-2">
          <ReportBtn href="/allure"    label="Allure"    icon="📊" ready={reports?.allureReady}   />
          <ReportBtn href="/pw-report" label="PW Report" icon="🎭" ready={reports?.pwReportReady} />
        </div>

        {/* Time range filter */}
        <div
          className="flex items-center gap-1 ml-4 px-1 py-[3px] rounded"
          style={{ background: 'rgba(0,0,0,.3)', border: '1px solid var(--border)' }}
        >
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="orb text-[9px] px-[10px] py-[4px] rounded transition-all cursor-pointer tracking-[0.5px]"
              style={{
                color:      range === r ? 'var(--cyan)' : 'var(--muted)',
                background: range === r ? 'rgba(0,212,255,.12)' : 'transparent',
                border:     `1px solid ${range === r ? 'rgba(0,212,255,.3)' : 'transparent'}`,
              }}
            >
              {r === 'today' ? 'Today' : r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All Time'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="orb text-[9px] text-dim">
            Last: <span className="text-text2">{new Date(summary.startTime).toLocaleString()}</span>
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="orb text-[10px] w-7 h-7 flex items-center justify-center rounded transition-all cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)', opacity: refreshing ? 0.5 : 1 }}
            onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,255,.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            title="Refresh"
          >
            <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          </button>
        </div>
      </header>

      {/* ─── Stats bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 grid grid-cols-6 gap-3 px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <StatCard value={summary.total}   label="Total"    color="var(--cyan)"   />
        <StatCard value={summary.passed}  label="Passed"   color="var(--green)"  />
        <StatCard value={summary.failed}  label="Failed"   color={summary.failed  > 0 ? 'var(--red)'    : 'var(--dim)'} />
        <StatCard value={summary.skipped} label="Skipped"  color={summary.skipped > 0 ? 'var(--yellow)' : 'var(--dim)'} />
        <StatCard value={summary.flaky}   label="Flaky"    color={summary.flaky   > 0 ? 'var(--orange)' : 'var(--dim)'} />
        <StatCard
          value={`${summary.passRate}%`}
          label="Pass Rate"
          color={rateColor}
          sub={fmsDuration(summary.duration)}
        />
      </div>

      {/* ─── HUD Pie Chart ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-b overflow-hidden"
        style={{ borderColor: 'var(--border)', height: 220 }}
      >
        <div className="flex h-full items-stretch">
          {/* Pie chart — centered */}
          <div className="flex-1 flex items-center justify-center py-1 px-2 overflow-hidden">
            <HUDPieChart
              passed={pieData.passed}
              failed={pieData.failed}
              skipped={pieData.skipped}
              flaky={pieData.flaky}
              runs={pieData.runs}
              label={range === 'today' ? 'TODAY' : range === 'week' ? 'THIS WEEK' : range === 'month' ? 'THIS MONTH' : 'ALL TIME'}
            />
          </div>

          {/* Right: period stats panel */}
          <div
            className="flex-shrink-0 flex flex-col justify-center gap-[5px] border-l px-4"
            style={{ borderColor: 'var(--border)', width: 160 }}
          >
            <div className="orb text-[8px] tracking-[1.5px] text-muted uppercase mb-1">Period Stats</div>

            {filteredHistory.length > 0 ? (
              <>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Runs</span>
                  <span className="text-cyan tabular-nums font-bold">{filteredHistory.length}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Avg rate</span>
                  <span className="tabular-nums" style={{ color: rateColor }}>
                    {(filteredHistory.reduce((s, h) => s + h.passRate, 0) / filteredHistory.length).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Best run</span>
                  <span className="text-green tabular-nums">{Math.max(...filteredHistory.map(h => h.passRate)).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Worst run</span>
                  <span className="text-red tabular-nums">{Math.min(...filteredHistory.map(h => h.passRate)).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Total tests</span>
                  <span className="text-text2 tabular-nums">{filteredHistory.reduce((s, h) => s + h.total, 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Current run</span>
                  <span className="text-cyan tabular-nums">1</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Pass rate</span>
                  <span className="tabular-nums" style={{ color: rateColor }}>{summary.passRate}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Duration</span>
                  <span className="text-muted tabular-nums">{fmsDuration(summary.duration)}</span>
                </div>
              </>
            )}

            <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border)' }}>
              <div className="orb text-[8px] tracking-[1.5px] text-muted uppercase mb-1">All Time</div>
              <div className="flex justify-between text-[10px]">
                <span className="text-dim">Total runs</span>
                <span className="text-cyan tabular-nums font-bold">{data.history.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main body: Test Results + AI Pipeline ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: Test Results */}
        <div className="flex flex-col overflow-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
          {/* Tab bar */}
          <div
            className="flex-shrink-0 flex items-center gap-2 px-4 py-[7px] border-b border-r"
            style={{ borderColor: 'var(--border)', background: 'rgba(0,212,255,.025)' }}
          >
            <span className="orb text-[9px] tracking-[1.5px] text-dim uppercase mr-1">Test Results</span>
            {([
              ['failures', `Failures (${failures.length})`],
              ['slowest',  `Slowest (${slowTests.length})`],
              ['all',      `All Tests (${specs.length})`],
            ] as [TestTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setTestTab(tab)}
                className="orb text-[9px] px-3 py-[4px] rounded transition-all cursor-pointer"
                style={{
                  color:      testTab === tab ? 'var(--cyan)' : 'var(--muted)',
                  background: testTab === tab ? 'rgba(0,212,255,.12)' : 'transparent',
                  border:     `1px solid ${testTab === tab ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Table */}
          <div className="flex-1 overflow-y-auto border-r" style={{ borderColor: 'var(--border)' }}>
            <SpecTable rows={testRows} />
          </div>
        </div>

        {/* Right: AI Pipeline + Project Breakdown */}
        <div
          className="flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: 340 }}
        >
          {/* AI Pipeline header */}
          <div
            className="flex-shrink-0 flex items-center gap-2 px-4 py-[7px] border-b"
            style={{ borderColor: 'var(--border)', background: 'rgba(0,212,255,.025)' }}
          >
            <span className="orb text-[9px] tracking-[1.5px] text-dim uppercase flex-1">AI Pipeline Runs</span>
            <span
              className="orb text-[8px] px-[6px] py-[1px] rounded"
              style={{ background: 'rgba(0,212,255,.1)', color: 'var(--cyan)' }}
            >
              {pipelineRows.length}
            </span>
          </div>
          {/* Pipeline table */}
          <div className="overflow-y-auto border-b" style={{ borderColor: 'var(--border)', flex: '0 0 50%' }}>
            <PipelineTable sessions={pipelineRows} />
          </div>

          {/* Project breakdown */}
          <div className="flex-shrink-0 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-[8px]">Project Breakdown</div>
            <div className="flex flex-col gap-[6px]">
              {projects.map(p => {
                const pct   = p.total > 0 ? (p.passed / p.total) * 100 : 0;
                const color = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="orb text-[9px] text-text2 w-24 truncate flex-shrink-0" title={p.name}>{p.name}</span>
                    <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-surface3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="orb text-[9px] tabular-nums text-muted w-10 text-right flex-shrink-0">
                      {p.passed}/{p.total}
                    </span>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <span className="text-[10px] text-dim">—</span>
              )}
            </div>
          </div>

          {/* Bottom: quick stats from filtered range */}
          <div className="flex-1 px-4 py-3 flex flex-col gap-[5px] overflow-y-auto">
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-1">Period Summary</div>
            {filteredHistory.length > 0 ? (
              <>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Runs in period</span>
                  <span className="text-text2 tabular-nums">{filteredHistory.length}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Avg pass rate</span>
                  <span className="tabular-nums" style={{ color: rateColor }}>
                    {(filteredHistory.reduce((s, h) => s + h.passRate, 0) / filteredHistory.length).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Best run</span>
                  <span className="text-green tabular-nums">
                    {Math.max(...filteredHistory.map(h => h.passRate)).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Worst run</span>
                  <span className="text-red tabular-nums">
                    {Math.min(...filteredHistory.map(h => h.passRate)).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-dim">Total tests run</span>
                  <span className="text-text2 tabular-nums">{filteredHistory.reduce((s, h) => s + h.total, 0)}</span>
                </div>
              </>
            ) : (
              <span className="text-[10px] text-dim">No runs in selected range</span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
