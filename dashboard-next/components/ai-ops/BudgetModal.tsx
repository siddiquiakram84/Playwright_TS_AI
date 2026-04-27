'use client';

import type { BudgetExceededPayload } from '@/types';

interface Props {
  payload: BudgetExceededPayload;
  onReset: () => void;
}

function fmt(type: 'token' | 'cost', n: number): string {
  if (type === 'token') return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  return `$${n.toFixed(4)}`;
}

export default function BudgetModal({ payload, onReset }: Props) {
  async function handleReset() {
    await fetch('/api/budget', { method: 'POST' }).catch(() => null);
    onReset();
  }

  const used  = fmt(payload.type, payload.used);
  const limit = payload.type === 'token'
    ? fmt('token', payload.limit)
    : `$${payload.limit.toFixed(2)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="panel-corners relative w-[440px] rounded-[4px] overflow-hidden"
        style={{
          background:  'linear-gradient(175deg, #1c030a 0%, #080104 100%)',
          border:      '1px solid rgba(255,61,90,.4)',
          boxShadow:   '0 0 60px rgba(255,61,90,.2)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-[14px] border-b"
          style={{ borderColor: 'rgba(255,61,90,.25)', background: 'rgba(255,61,90,.07)' }}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 animate-live-pulse"
            style={{ background: 'var(--red)', boxShadow: 'var(--glow-r)' }}
          />
          <span className="orb text-[12px] font-black tracking-[3px] text-red animate-budget-pulse">
            BUDGET LIMIT EXCEEDED
          </span>
        </div>

        {/* Stats grid */}
        <div className="px-5 pt-5 pb-4">
          <p className="orb text-[9px] tracking-[1.5px] text-muted uppercase text-center mb-4">
            {payload.type === 'token' ? 'Token' : 'Cost'} limit reached — AI operations are blocked
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'USED',  value: used  },
              { label: 'LIMIT', value: limit },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="text-center py-4 rounded"
                style={{ background: 'rgba(255,61,90,.09)', border: '1px solid rgba(255,61,90,.22)' }}
              >
                <div className="orb text-[22px] font-black text-red leading-none">{value}</div>
                <div className="orb text-[9px] tracking-[1.5px] text-muted mt-2">{label}</div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-text2 text-center">
            Session: <span className="text-cyan">{payload.calls}</span> calls
            &nbsp;·&nbsp;
            <span className="text-cyan">${payload.estimatedCostUsd.toFixed(4)}</span> total cost
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 orb text-[10px] font-bold tracking-[1px] py-[11px] rounded cursor-pointer transition-all"
            style={{
              background: 'rgba(255,61,90,.14)',
              border:     '1px solid rgba(255,61,90,.4)',
              color:      'var(--red)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,61,90,.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,61,90,.14)')}
          >
            ⟳ RESET LIMITS &amp; CONTINUE
          </button>
        </div>

        <p className="pb-4 text-[10px] text-muted text-center">
          Adjust limits in the Config panel before resetting
        </p>
      </div>
    </div>
  );
}
