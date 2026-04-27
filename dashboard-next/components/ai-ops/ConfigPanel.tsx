'use client';

import { useState, useEffect } from 'react';
import { PanelHeader } from '@/components/ui/Panel';
import type { BudgetState } from '@/types';

interface Props {
  budget:          BudgetState;
  provider:        string;
  onBudgetUpdate:  (b: BudgetState) => void;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function BarRow({
  label, used, limit, colorVar, fmtFn,
}: {
  label: string;
  used: number;
  limit: number;
  colorVar: string;
  fmtFn: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const warn = pct >= 80;
  const bar  = warn ? 'var(--red)' : colorVar;

  return (
    <div className="space-y-[5px]">
      <div className="flex justify-between items-baseline">
        <span className="orb-label">{label}</span>
        <span className="orb text-[10px] tabular-nums" style={{ color: bar }}>
          {fmtFn(used)} {limit > 0 ? `/ ${fmtFn(limit)}` : ''}
        </span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--surface3)' }}>
        {limit > 0 && (
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: bar, boxShadow: `0 0 6px ${bar}66` }}
          />
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px mx-4" style={{ background: 'var(--border)' }} />;
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-[7px]">
      <span className="orb-label">{label}</span>
      <span
        className={`text-[11px] text-cyan2 ${mono ? 'font-mono' : 'orb font-bold tracking-[.5px]'} truncate max-w-[140px]`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export default function ConfigPanel({ budget, provider, onBudgetUpdate }: Props) {
  const [config, setConfig]     = useState<{ model?: string; langsmithEnabled?: boolean; langsmithProject?: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tkInput,  setTkInput]  = useState('');
  const [costInput, setCostInput] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => null);

    fetch('/api/budget')
      .then(r => r.json())
      .then((d: BudgetState) => {
        onBudgetUpdate(d);
        setTkInput(d.tokenLimit > 0 ? String(d.tokenLimit) : '');
        setCostInput(d.costLimitUsd > 0 ? d.costLimitUsd.toFixed(2) : '');
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLimits() {
    setSaving(true);
    const tokenLimit   = parseInt(tkInput)   || 0;
    const costLimitUsd = parseFloat(costInput) || 0;
    await fetch('/api/budget', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tokenLimit, costLimitUsd }),
    }).catch(() => null);
    onBudgetUpdate({ ...budget, tokenLimit, costLimitUsd });
    setSaving(false);
    setEditOpen(false);
  }

  async function resetBudget() {
    await fetch('/api/budget', { method: 'POST' }).catch(() => null);
    onBudgetUpdate({ ...budget, tokenLimit: 0, costLimitUsd: 0 });
    setTkInput(''); setCostInput('');
  }

  const totalTokens = budget.totalTokens;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Provider info */}
      <PanelHeader title="Provider Config" />
      <InfoRow label="AI Provider" value={provider.toUpperCase()} />
      <InfoRow label="Model"       value={config?.model ?? '…'} mono />
      <InfoRow
        label="LangSmith"
        value={config?.langsmithEnabled ? (config.langsmithProject || 'enabled') : 'disabled'}
      />

      <Divider />

      {/* Session usage */}
      <PanelHeader title="Session Usage" />
      <div className="px-4 pt-3 pb-4 space-y-4">
        <BarRow
          label="Tokens"
          used={totalTokens}
          limit={budget.tokenLimit}
          colorVar="var(--cyan)"
          fmtFn={fmtNum}
        />
        <BarRow
          label="Cost USD"
          used={budget.estimatedCostUsd}
          limit={budget.costLimitUsd}
          colorVar="var(--green)"
          fmtFn={n => `$${n.toFixed(4)}`}
        />
        <div className="flex justify-between">
          <span className="orb-label">LLM Calls</span>
          <span className="orb text-[11px] text-cyan">{budget.calls}</span>
        </div>
      </div>

      <Divider />

      {/* Budget guard */}
      <PanelHeader
        title="Budget Guard"
        right={
          <button
            onClick={() => setEditOpen(v => !v)}
            className="orb text-[9px] tracking-[.5px] px-[10px] py-[4px] rounded cursor-pointer transition-all"
            style={{
              background: editOpen ? 'rgba(0,212,255,.15)' : 'rgba(0,212,255,.06)',
              border:     '1px solid rgba(0,212,255,.3)',
              color:      'var(--cyan)',
            }}
          >
            {editOpen ? 'CLOSE' : 'SET LIMITS'}
          </button>
        }
      />

      {editOpen && (
        <div className="px-4 pt-3 pb-4 space-y-3 animate-slide-in">
          <div>
            <label className="orb-label block mb-1">Token Limit (0 = unlimited)</label>
            <input
              type="number"
              min="0"
              value={tkInput}
              onChange={e => setTkInput(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-[7px] rounded outline-none focus:border-cyan transition-colors"
            />
          </div>
          <div>
            <label className="orb-label block mb-1">Cost Limit USD (0 = unlimited)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costInput}
              onChange={e => setCostInput(e.target.value)}
              placeholder="e.g. 5.00"
              className="w-full bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-[7px] rounded outline-none focus:border-cyan transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveLimits}
              disabled={saving}
              className="flex-1 orb text-[9px] tracking-[.5px] py-[8px] rounded cursor-pointer transition-all"
              style={{
                background: 'rgba(0,212,255,.12)',
                border:     '1px solid rgba(0,212,255,.35)',
                color:      'var(--cyan)',
              }}
            >
              {saving ? '…' : '✓ SAVE'}
            </button>
            <button
              onClick={resetBudget}
              className="orb text-[9px] tracking-[.5px] px-3 py-[8px] rounded cursor-pointer transition-all"
              style={{
                background: 'rgba(255,61,90,.08)',
                border:     '1px solid rgba(255,61,90,.25)',
                color:      'var(--red)',
              }}
            >
              RESET
            </button>
          </div>
        </div>
      )}

      {/* spacer */}
      <div className="flex-1" />
    </div>
  );
}
