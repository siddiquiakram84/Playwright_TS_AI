'use client';

import { useState, useRef, useCallback } from 'react';
import { useSSE } from '@/hooks/useSSE';
import type { OrchestratorStepEvent } from '@core/ai/ops/AIEventBus';

type StepId = 'parse' | 'generate' | 'execute' | 'heal' | 'analyze' | 'ticket' | 'summary';
type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

interface StepState {
  status: StepStatus;
  detail: string;
  ts?:    number;
}

interface RunResult {
  sessionId:  string;
  testCount:  number;
  passed:     number;
  failed:     number;
  healedCount: number;
  tickets:    Array<{ key: string; url: string; category: string }>;
}

const STEPS: { id: StepId; label: string; icon: string }[] = [
  { id: 'parse',    label: 'Parse Input',       icon: '📥' },
  { id: 'generate', label: 'Generate Tests',     icon: '✍' },
  { id: 'execute',  label: 'Execute',            icon: '▶' },
  { id: 'heal',     label: 'Self-Heal',          icon: '🔧' },
  { id: 'analyze',  label: 'Analyze Report',     icon: '📊' },
  { id: 'ticket',   label: 'Create Tickets',     icon: '🎫' },
  { id: 'summary',  label: 'Summary Checkpoint', icon: '✅' },
];

const INIT_STEPS: Record<StepId, StepState> = {
  parse:    { status: 'idle', detail: '' },
  generate: { status: 'idle', detail: '' },
  execute:  { status: 'idle', detail: '' },
  heal:     { status: 'idle', detail: '' },
  analyze:  { status: 'idle', detail: '' },
  ticket:   { status: 'idle', detail: '' },
  summary:  { status: 'idle', detail: '' },
};

const STATUS_COLOR: Record<StepStatus, string> = {
  idle:    'var(--border2)',
  running: 'var(--yellow)',
  done:    'var(--green)',
  error:   'var(--red)',
  skipped: 'var(--dim)',
};

type SourceOption = 'story' | 'nl' | 'txt' | 'json' | 'excel';

const SOURCE_OPTS: { value: SourceOption; label: string }[] = [
  { value: 'story', label: '💬 User Story' },
  { value: 'nl',    label: '🗣 Natural Language' },
  { value: 'txt',   label: '📄 Manual TXT Cases' },
  { value: 'json',  label: '📋 JSON Test Cases' },
  { value: 'excel', label: '📊 Excel (.xlsx)' },
];

export default function OrchestratorPanel() {
  const [steps,   setSteps]   = useState<Record<StepId, StepState>>(INIT_STEPS);
  const [source,  setSource]  = useState<SourceOption>('story');
  const [input,   setInput]   = useState('');
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState<RunResult | null>(null);
  const [error,   setError]   = useState('');
  const [runTests, setRunTests] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  // Listen to orchestrator SSE events
  const onOrchStep = useCallback((d: unknown) => {
    const e = d as OrchestratorStepEvent;
    setSteps(prev => ({
      ...prev,
      [e.step]: { status: e.status, detail: e.detail, ts: e.timestamp },
    }));
  }, []);

  useSSE({ 'orchestrator:step': onOrchStep }, {});

  async function handleRun() {
    setRunning(true);
    setError('');
    setResult(null);
    setSteps(INIT_STEPS);

    try {
      let res: Response;

      const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

      if (source === 'excel') {
        const file = fileRef.current?.files?.[0];
        if (!file) { setError('Please select an Excel file'); setRunning(false); return; }
        const form = new FormData();
        form.append('source', 'excel');
        form.append('file', file);
        form.append('runTests', String(runTests));
        res = await fetch('/api/orchestrate', {
          method:  'POST',
          headers: { 'x-admin-secret': secret },
          body:    form,
        });
      } else {
        if (!input.trim()) { setError('Please enter input text'); setRunning(false); return; }
        res = await fetch('/api/orchestrate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
          body:    JSON.stringify({ source, input, runTests }),
        });
      }

      const data = await res.json() as RunResult & { error?: string };
      if (!res.ok) { setError(data.error ?? 'Pipeline failed'); return; }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 flex justify-between items-center px-4 py-[9px] border-b"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}
      >
        <span className="text-[11px] font-semibold tracking-[.5px] uppercase text-muted">
          AI Orchestrator
        </span>
        <span
          className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${running ? 'animate-live-pulse' : ''}`}
          style={{ background: running ? 'var(--yellow)' : 'var(--dim)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Source selector */}
        <div className="px-4 pt-3 pb-2">
          <label className="orb-label block mb-1">Input Type</label>
          <select
            value={source}
            onChange={e => { setSource(e.target.value as SourceOption); setInput(''); setFileName(''); }}
            className="w-full bg-surface2 border border-border2 text-text text-[11px] px-3 py-[7px] rounded-md outline-none focus:border-cyan cursor-pointer"
          >
            {SOURCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Input area */}
        {source === 'excel' ? (
          <div className="px-4 pb-2">
            <label className="orb-label block mb-1">Excel File (.xlsx)</label>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
              onChange={e => setFileName(e.target.files?.[0]?.name ?? '')} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full text-[11px] py-[9px] rounded-md cursor-pointer"
              style={{ background: 'rgba(59,130,246,.06)', border: '1px dashed rgba(59,130,246,.3)', color: 'var(--cyan2)' }}
            >
              {fileName || '📁 Select Excel file'}
            </button>
          </div>
        ) : (
          <div className="px-4 pb-2">
            <label className="orb-label block mb-1">
              {source === 'json' ? 'JSON test cases' : source === 'txt' ? 'Manual test cases' : 'Story / description'}
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                source === 'json' ? '[{"id":"TC-001","title":"...","steps":[...],"expectedResult":"..."}]' :
                source === 'txt'  ? 'Test Case: Login\nSteps:\n1. Navigate to login\n2. Enter email...\nExpected: User logged in' :
                'As a user, I want to log in with valid credentials...'
              }
              rows={5}
              className="w-full bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-2 rounded-md outline-none focus:border-cyan resize-none leading-[1.6]"
            />
          </div>
        )}

        {/* Run tests toggle */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="runTests"
            checked={runTests}
            onChange={e => setRunTests(e.target.checked)}
            className="cursor-pointer"
          />
          <label htmlFor="runTests" className="orb-label cursor-pointer">
            Execute tests after generation
          </label>
        </div>

        {/* Run button */}
        <div className="px-4 pb-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full text-[11px] font-semibold py-[11px] rounded-md cursor-pointer transition-all disabled:opacity-40"
            style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.3)', color: 'var(--cyan)' }}
          >
            {running ? '⋯ Pipeline running…' : '▶ Run Full Pipeline'}
          </button>
        </div>

        {error && (
          <p className="px-4 pb-2 text-[10px] text-red font-mono animate-slide-in">{error}</p>
        )}

        {/* Pipeline step tracker */}
        <div className="px-4 pb-3">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[.5px] mb-2">Pipeline</div>
          <div className="space-y-[6px]">
            {STEPS.map(step => {
              const s = steps[step.id];
              return (
                <div key={step.id} className="flex items-start gap-2">
                  <span
                    className="w-[8px] h-[8px] rounded-full flex-shrink-0 mt-[3px]"
                    style={{ background: STATUS_COLOR[s.status] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]">{step.icon}</span>
                      <span className="text-[11px] font-medium text-text">{step.label}</span>
                    </div>
                    {s.detail && (
                      <p className="text-[10px] text-muted mt-[1px] truncate" title={s.detail}>{s.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Result summary */}
        {result && (
          <div className="px-4 pb-4 animate-slide-in">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[.5px] mb-2">Result</div>
            <div
              className="rounded-md p-3 space-y-1"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            >
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">Tests</span>
                <span className="font-mono text-text">{result.testCount} generated</span>
              </div>
              {runTests && (
                <>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Passed</span>
                    <span className="font-mono text-green2">{result.passed}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Failed</span>
                    <span className="font-mono text-red">{result.failed}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Auto-healed</span>
                    <span className="font-mono text-cyan2">{result.healedCount}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-[11px]">
                <span className="text-muted">Tickets</span>
                <span className="font-mono text-text">{result.tickets?.length ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
