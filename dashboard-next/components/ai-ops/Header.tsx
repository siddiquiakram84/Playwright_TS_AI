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

function HexLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        fill="none" stroke="rgba(0,212,255,.35)" strokeWidth="1"
      />
      <polygon
        points="16,6 25,11 25,21 16,26 7,21 7,11"
        fill="rgba(0,212,255,.08)" stroke="#00d4ff" strokeWidth="1.3"
        className="animate-hex-spin"
        style={{ transformOrigin: '16px 16px' }}
      />
      <text
        x="16" y="20" textAnchor="middle"
        fontFamily="Orbitron,sans-serif" fontSize="8" fontWeight="900" fill="#00d4ff"
      >
        AI
      </text>
    </svg>
  );
}

function Clock() {
  const [time, setTime] = useState('');
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
    <div
      className="mx-auto orb text-[16px] font-bold tracking-[4px] text-cyan"
      style={{ textShadow: 'var(--glow-c)' }}
    >
      {time}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div
        className="orb text-[18px] font-bold text-cyan tabular-nums leading-none"
        style={{ textShadow: 'var(--glow-c)' }}
      >
        {value}
      </div>
      <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mt-[2px]">{label}</div>
    </div>
  );
}

function Sep() {
  return (
    <div
      className="w-px h-[30px]"
      style={{ background: 'linear-gradient(180deg, transparent, var(--border2), transparent)' }}
    />
  );
}

export default function Header({ metrics, totalTokens, connected, provider }: HeaderProps) {
  const [adminOpen,      setAdminOpen]      = useState(false);
  const [liveProvider,   setLiveProvider]   = useState(provider);

  // Keep liveProvider in sync if parent prop changes via SSE admin event
  useEffect(() => { setLiveProvider(provider); }, [provider]);
  return (
    <>
    <header
      className="header-scan flex-shrink-0 h-14 flex items-center gap-[14px] px-5 overflow-hidden relative z-10"
      style={{
        background:   'linear-gradient(90deg, #030d1a 0%, #071525 50%, #030d1a 100%)',
        borderBottom: '1px solid var(--border2)',
        boxShadow:    '0 2px 20px rgba(0,0,0,.7), 0 1px 0 rgba(0,212,255,.15)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] flex-shrink-0">
        <div style={{ filter: 'drop-shadow(0 0 7px rgba(0,212,255,.6))' }}>
          <HexLogo />
        </div>
        <div>
          <div
            className="orb text-[16px] font-black tracking-[5px] text-cyan"
            style={{ textShadow: 'var(--glow-c)' }}
          >
            AI OPS
          </div>
          <div className="orb text-[9px] tracking-[3px] text-muted mt-[1px]">
            COMMAND CENTER
          </div>
        </div>
      </div>

      {/* Provider badge */}
      <div
        className="orb text-[10px] font-bold tracking-[1px] px-[11px] py-1 rounded-[3px] whitespace-nowrap text-cyan2 flex-shrink-0"
        style={{ background: 'rgba(0,212,255,.09)', border: '1px solid rgba(0,212,255,.3)' }}
      >
        {provider.toUpperCase()}
      </div>

      {/* Live badge */}
      <div
        className="flex items-center gap-[7px] orb text-[10px] font-bold tracking-[1px] px-[11px] py-1 rounded-[3px] text-green2 flex-shrink-0"
        style={{ background: 'rgba(0,232,154,.09)', border: '1px solid rgba(0,232,154,.3)' }}
      >
        <span
          className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${connected ? 'animate-live-pulse' : ''}`}
          style={{
            background: connected ? 'var(--green)' : 'var(--yellow)',
            boxShadow:  connected ? 'var(--glow-g)' : 'var(--glow-y)',
          }}
        />
        {connected ? 'LIVE' : 'CONNECTING'}
      </div>

      <Clock />

      {/* Stats */}
      <div className="flex items-center gap-4 ml-auto">
        <Sep />
        <Stat value={String(metrics.calls)} label="Calls" />
        <Sep />
        <Stat value={fmtNum(totalTokens)} label="Tokens" />
        <Sep />
        <Stat value={`$${metrics.estimatedCostUsd.toFixed(3)}`} label="Cost" />
        <Sep />
        <button
          className="orb text-[10px] tracking-[1px] px-[14px] py-[7px] rounded-[3px] border border-border2 bg-surface2 text-text2 cursor-pointer transition-all hover:border-cyan hover:text-cyan"
          style={{ transition: 'all .15s' }}
          onClick={() => setAdminOpen(true)}
        >
          ⚙ ADMIN
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
