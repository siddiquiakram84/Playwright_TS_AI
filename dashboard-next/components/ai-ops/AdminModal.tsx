'use client';

import { useState } from 'react';
import type { SessionMetrics } from '@/types';

interface Props {
  metrics:  SessionMetrics;
  provider: string;
  onClose:  () => void;
  onProviderChange: (p: string) => void;
}

type Status = 'idle' | 'pending' | 'ok' | 'err';

interface ActionRow {
  id:      string;
  label:   string;
  desc:    string;
  color:   string;
  confirm: boolean;
}

const ACTIONS: ActionRow[] = [
  { id: 'reset-session',   label: 'Reset Session Totals', desc: 'Zero out token / cost counters for this server run.', color: 'var(--cyan)',   confirm: true  },
  { id: 'clear-cache',     label: 'Clear Response Cache', desc: 'Evict all cached AI responses — next calls go live.', color: 'var(--yellow)', confirm: true  },
  { id: 'reset-client',    label: 'Reset AI Client',      desc: 'Destroy the AIClient singleton; rebuilt on next call.', color: 'var(--orange)', confirm: true  },
];

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function AdminModal({ metrics, provider, onClose, onProviderChange }: Props) {
  const [statuses,    setStatuses]    = useState<Record<string, Status>>({});
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [nextProvider, setNextProvider] = useState(provider);
  const [switchStatus, setSwitchStatus] = useState<Status>('idle');
  const [cacheStats,   setCacheStats]   = useState<{ size: number; hits: number; misses: number; hitRate: number } | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);

  async function runAction(id: string, extra?: Record<string, unknown>) {
    setStatuses(s => ({ ...s, [id]: 'pending' }));
    try {
      const res = await fetch('/api/admin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: id, ...extra }),
      });
      setStatuses(s => ({ ...s, [id]: res.ok ? 'ok' : 'err' }));
      setTimeout(() => setStatuses(s => ({ ...s, [id]: 'idle' })), 2500);
    } catch {
      setStatuses(s => ({ ...s, [id]: 'err' }));
      setTimeout(() => setStatuses(s => ({ ...s, [id]: 'idle' })), 2500);
    }
    setConfirmId(null);
  }

  async function switchProvider() {
    setSwitchStatus('pending');
    try {
      const res = await fetch('/api/admin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'switch-provider', provider: nextProvider }),
      });
      if (res.ok) {
        onProviderChange(nextProvider);
        setSwitchStatus('ok');
      } else {
        setSwitchStatus('err');
      }
    } catch {
      setSwitchStatus('err');
    }
    setTimeout(() => setSwitchStatus('idle'), 2500);
  }

  async function loadCacheStats() {
    setLoadingCache(true);
    try {
      const res  = await fetch('/api/metrics');
      const data = await res.json() as { responseCache?: typeof cacheStats };
      setCacheStats(data.responseCache ?? null);
    } catch { /* ignore */ }
    setLoadingCache(false);
  }

  const statusColor = (s: Status) =>
    s === 'ok'      ? 'var(--green)'
    : s === 'err'   ? 'var(--red)'
    : s === 'pending' ? 'var(--yellow)'
    : 'inherit';

  const statusLabel = (s: Status, idle: string) =>
    s === 'ok' ? '✓ DONE' : s === 'err' ? '✗ FAILED' : s === 'pending' ? '…' : idle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.65)' }}
      onClick={onClose}
    >
      <div
        className="panel-corners relative flex flex-col overflow-hidden rounded"
        style={{
          width: 480, maxHeight: '85vh',
          background: 'linear-gradient(175deg, var(--surface) 0%, var(--bg) 100%)',
          border: '1px solid var(--border2)',
          boxShadow: '0 0 40px rgba(0,212,255,.12), 0 8px 32px rgba(0,0,0,.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border2)', background: 'rgba(0,212,255,.05)' }}
        >
          <span className="orb text-[13px] font-black tracking-[3px] text-cyan" style={{ textShadow: 'var(--glow-c)' }}>
            ⚙ ADMIN
          </span>
          <button
            onClick={onClose}
            className="orb text-[11px] text-muted hover:text-text transition-colors cursor-pointer px-2"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Session snapshot */}
          <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-3">Session Snapshot</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Calls',  value: String(metrics.calls) },
                { label: 'Tokens', value: fmtNum(metrics.inputTokens + metrics.outputTokens) },
                { label: 'Cost',   value: `$${metrics.estimatedCostUsd.toFixed(4)}` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center py-2 rounded" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div className="orb text-[15px] font-bold text-cyan tabular-nums">{value}</div>
                  <div className="orb text-[9px] tracking-[1px] text-muted mt-[3px]">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Cache stats */}
          <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="orb text-[9px] tracking-[1.5px] text-muted uppercase">Response Cache</span>
              <button
                onClick={loadCacheStats}
                className="orb text-[9px] tracking-[.5px] px-2 py-[3px] rounded cursor-pointer transition-all"
                style={{ background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--cyan)' }}
              >
                {loadingCache ? '…' : 'REFRESH'}
              </button>
            </div>
            {cacheStats ? (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Entries', value: String(cacheStats.size) },
                  { label: 'Hits',    value: String(cacheStats.hits) },
                  { label: 'Misses',  value: String(cacheStats.misses) },
                  { label: 'Hit Rate',value: `${cacheStats.hitRate}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center py-[6px] rounded" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="orb text-[12px] font-bold text-cyan2 tabular-nums">{value}</div>
                    <div className="orb text-[8px] tracking-[.5px] text-muted mt-[2px]">{label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-dim">Click REFRESH to load cache stats.</div>
            )}
          </section>

          {/* Provider switch */}
          <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-3">Switch Provider</div>
            <div className="flex gap-2">
              <select
                value={nextProvider}
                onChange={e => setNextProvider(e.target.value)}
                className="flex-1 bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-[7px] rounded outline-none focus:border-cyan transition-colors cursor-pointer"
              >
                <option value="anthropic">anthropic</option>
                <option value="local">local (ollama)</option>
              </select>
              <button
                onClick={switchProvider}
                disabled={switchStatus === 'pending' || nextProvider === provider}
                className="orb text-[9px] tracking-[.5px] px-4 py-[7px] rounded cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(0,212,255,.1)',
                  border:     '1px solid rgba(0,212,255,.3)',
                  color:      switchStatus !== 'idle' ? statusColor(switchStatus) : 'var(--cyan)',
                }}
              >
                {statusLabel(switchStatus, 'SWITCH')}
              </button>
            </div>
            {nextProvider === provider && (
              <div className="text-[10px] text-dim mt-2">Already using {provider}.</div>
            )}
          </section>

          {/* Actions */}
          <section className="px-5 py-4">
            <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mb-3">Actions</div>
            <div className="flex flex-col gap-2">
              {ACTIONS.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-3 py-[10px] rounded"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="orb text-[10px] font-bold" style={{ color: a.color }}>{a.label}</div>
                    <div className="text-[10px] text-dim mt-[2px]">{a.desc}</div>
                  </div>
                  {confirmId === a.id ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => runAction(a.id)}
                        className="orb text-[9px] tracking-[.5px] px-3 py-[5px] rounded cursor-pointer"
                        style={{ background: 'rgba(255,61,90,.15)', border: '1px solid rgba(255,61,90,.35)', color: 'var(--red)' }}
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="orb text-[9px] px-2 py-[5px] rounded cursor-pointer"
                        style={{ border: '1px solid var(--border2)', color: 'var(--muted)' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => a.confirm ? setConfirmId(a.id) : runAction(a.id)}
                      disabled={statuses[a.id] === 'pending'}
                      className="orb text-[9px] tracking-[.5px] px-3 py-[5px] rounded cursor-pointer transition-all flex-shrink-0 disabled:opacity-50"
                      style={{
                        background: `${a.color}14`,
                        border:     `1px solid ${a.color}44`,
                        color:      statuses[a.id] && statuses[a.id] !== 'idle' ? statusColor(statuses[a.id]!) : a.color,
                      }}
                    >
                      {statusLabel(statuses[a.id] ?? 'idle', 'RUN')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
