'use client';

import { useState, useEffect } from 'react';
import AdminModal from '@/components/ai-ops/AdminModal';
import type { SessionMetrics } from '@/types';

interface HeaderProps {
  metrics:     SessionMetrics;
  totalTokens: number;
  connected:   boolean;
  provider:    string;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function Mark() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
      background: 'var(--cyan)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '.5px' }}>AI</span>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    function tick() {
      const d = new Date();
      setTime(
        String(d.getHours()).padStart(2, '0')   + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0'),
      );
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden sm:block text-[14px] font-semibold tracking-[3px] text-text2 tabular-nums font-mono flex-shrink-0 mx-auto">
      {time}
    </div>
  );
}

function Sep() {
  return <div className="w-px self-stretch" style={{ background: 'var(--border2)', minHeight: 20 }} />;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center min-w-[48px]">
      <div className="text-[15px] font-bold text-text tabular-nums leading-none font-mono">
        {value}
      </div>
      <div className="text-[9px] text-muted mt-[3px] uppercase tracking-[.5px]">{label}</div>
    </div>
  );
}

export default function Header({ metrics, totalTokens, connected, provider }: HeaderProps) {
  const [adminOpen,    setAdminOpen]    = useState(false);
  const [liveProvider, setLiveProvider] = useState(provider);

  useEffect(() => { setLiveProvider(provider); }, [provider]);

  return (
    <>
    <header
      className="flex-shrink-0 flex items-center gap-3 px-4 relative z-10"
      style={{
        height:       52,
        background:   'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[9px] flex-shrink-0">
        <Mark />
        <div className="hidden sm:block">
          <div className="text-[13px] font-bold tracking-[2.5px] text-text leading-none">AI OPS</div>
          <div className="text-[9px] tracking-[2px] text-muted mt-[2px]">OPERATIONS</div>
        </div>
      </div>

      {/* Provider badge */}
      <div
        className="flex-shrink-0 text-[10px] font-bold tracking-[.5px] px-[9px] py-[4px] rounded-[4px] text-cyan2"
        style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)' }}
      >
        {liveProvider.toUpperCase()}
      </div>

      {/* Live badge */}
      <div
        className="flex-shrink-0 flex items-center gap-[6px] text-[10px] font-semibold tracking-[.5px] px-[9px] py-[4px] rounded-[4px]"
        style={{
          background: connected ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)',
          border:     connected ? '1px solid rgba(34,197,94,.22)' : '1px solid rgba(245,158,11,.22)',
          color:      connected ? 'var(--green2)' : 'var(--yellow)',
        }}
      >
        <span
          className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${connected ? 'animate-live-pulse' : ''}`}
          style={{ background: connected ? 'var(--green)' : 'var(--yellow)' }}
        />
        {connected ? 'LIVE' : 'CONNECTING'}
      </div>

      {/* Clock — centred, hidden on very narrow viewports */}
      <Clock />

      {/* Right side — stats + admin */}
      <div className="flex items-center gap-3 ml-auto flex-shrink-0">
        <Sep />
        <Stat value={String(metrics.calls)}                    label="Calls"  />
        <Sep />
        <Stat value={fmtNum(totalTokens)}                      label="Tokens" />
        <Sep />
        <Stat value={`$${metrics.estimatedCostUsd.toFixed(3)}`} label="Cost"  />
        <Sep />
        {/* LangSmith traces link */}
        <a
          href="https://smith.langchain.com/o/playwright-project"
          target="_blank"
          rel="noopener noreferrer"
          title="Open LangSmith traces"
          className="flex items-center gap-[5px] text-[10px] font-semibold px-[10px] py-[5px] rounded-[4px] flex-shrink-0 transition-all"
          style={{
            color:      '#f0c040',
            background: 'rgba(240,192,64,.08)',
            border:     '1px solid rgba(240,192,64,.25)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(240,192,64,.18)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(240,192,64,.08)'; }}
        >
          🔗 LangSmith ↗
        </a>
        <Sep />
        <button
          onClick={() => setAdminOpen(true)}
          className="text-[11px] font-medium px-[12px] py-[6px] rounded-[4px] border border-border2 text-text2 cursor-pointer transition-all hover:border-border hover:text-text hover:bg-surface2 flex-shrink-0"
        >
          ⚙ Admin
        </button>
      </div>
    </header>

    {adminOpen && (
      <AdminModal
        metrics={metrics}
        provider={liveProvider}
        onClose={() => setAdminOpen(false)}
        onProviderChange={p => setLiveProvider(p)}
      />
    )}
    </>
  );
}
