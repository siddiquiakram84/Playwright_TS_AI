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
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-[440px] rounded-lg overflow-hidden"
        style={{
          background: 'var(--surface)',
          border:     '1px solid rgba(239,68,68,.35)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-[14px] border-b"
          style={{ borderColor: 'rgba(239,68,68,.2)', background: 'rgba(239,68,68,.06)' }}
        >
          <span
            className="w-[10px] h-[10px] rounded-full flex-shrink-0 animate-live-pulse"
            style={{ background: 'var(--red)' }}
          />
          <span className="text-[13px] font-bold tracking-[1px] text-red animate-budget-pulse">
            Budget Limit Exceeded
          </span>
        </div>

        {/* Stats grid */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11px] text-muted text-center mb-4">
            {payload.type === 'token' ? 'Token' : 'Cost'} limit reached — AI operations are blocked
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Used',  value: used  },
              { label: 'Limit', value: limit },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="text-center py-4 rounded-md"
                style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)' }}
              >
                <div className="text-[22px] font-bold text-red leading-none font-mono">{value}</div>
                <div className="text-[10px] text-muted mt-2 uppercase tracking-[.5px]">{label}</div>
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
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 text-[11px] font-semibold py-[11px] rounded-md cursor-pointer transition-all"
            style={{
              background: 'rgba(239,68,68,.1)',
              border:     '1px solid rgba(239,68,68,.35)',
              color:      'var(--red)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.1)')}
          >
            Reset Limits &amp; Continue
          </button>
        </div>

        <p className="pb-4 text-[10px] text-muted text-center">
          Adjust limits in the Config panel before resetting
        </p>
      </div>
    </div>
  );
}
