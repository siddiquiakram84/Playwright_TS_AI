'use client';

import { useState, useRef } from 'react';
import { PanelHeader } from '@/components/ui/Panel';

const SOURCE_OPTS = [
  { value: 'story',      label: '📝 User Story'    },
  { value: 'nl',         label: '💬 Natural Lang'   },
  { value: 'squishtest', label: '🖥 Squishtest Qt'  },
  { value: 'json-tc',    label: '📋 JSON Test Cases' },
  { value: 'txt-tc',     label: '📄 Manual TXT'     },
];

type GenStatus = 'idle' | 'running' | 'done' | 'error';

function StatusDot({ status }: { status: GenStatus }) {
  const map: Record<GenStatus, { cls: string; label: string }> = {
    idle:    { cls: '',             label: 'READY'   },
    running: { cls: 'sdot-pending', label: 'RUNNING' },
    done:    { cls: '',             label: 'DONE'    },
    error:   { cls: 'sdot-error',   label: 'ERROR'   },
  };
  const { cls, label } = map[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`sdot ${cls}`} />
      <span className="text-[9px] font-semibold tracking-[1px] text-muted">{label}</span>
    </div>
  );
}

export default function RecorderPanel() {
  const [source,  setSource]  = useState('story');
  const [input,   setInput]   = useState('');
  const [status,  setStatus]  = useState<GenStatus>('idle');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const placeholder = {
    story:      'Describe the feature in plain English…',
    nl:         'Natural language description of test steps…',
    squishtest: 'Describe the Qt/desktop workflow to test…',
    'json-tc':  'Paste JSON test cases array…',
    'txt-tc':   'Paste manual test case text…',
  }[source] ?? '';

  const needsFile = source === 'json-tc' || source === 'txt-tc';

  async function handleGenerate() {
    if (!input.trim()) return;
    setStatus('running');
    setMessage('');
    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ source, input }),
      });
      const data = await res.json() as { filename?: string; testCount?: number; error?: string };
      if (!res.ok || data.error) {
        setStatus('error');
        setMessage(data.error ?? 'Generation failed');
      } else {
        setStatus('done');
        setMessage(`✓ ${data.testCount ?? 0} test(s) → ${data.filename ?? ''}`);
      }
    } catch (err) {
      setStatus('error');
      setMessage(String(err));
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setInput(String(ev.target?.result ?? ''));
    reader.readAsText(file);
  }

  return (
    // Outer: full height, flex-col. Split into scrollable body + fixed footer.
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <PanelHeader title="Test Generator" right={<StatusDot status={status} />} />

      {/* ── Scrollable body (source + textarea + button) ──────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Source selector */}
        <div className="px-4 pt-3 pb-2">
          <label className="orb-label block mb-1">Input Type</label>
          <select
            value={source}
            onChange={e => { setSource(e.target.value); setInput(''); }}
            className="w-full bg-surface2 border border-border2 text-text text-[11px] px-3 py-[7px] rounded-md outline-none focus:border-cyan transition-colors cursor-pointer"
          >
            {SOURCE_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* File upload */}
        {needsFile && (
          <div className="px-4 pb-2">
            <input
              ref={fileRef}
              type="file"
              accept={source === 'json-tc' ? '.json' : '.txt'}
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full text-[10px] font-semibold py-[7px] rounded-md cursor-pointer transition-all"
              style={{
                background: 'rgba(59,130,246,.06)',
                border:     '1px dashed rgba(59,130,246,.3)',
                color:      'var(--cyan2)',
              }}
            >
              📁 UPLOAD FILE
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="px-4 pb-2">
          <label className="orb-label block mb-1">
            {needsFile ? 'Or paste content below' : 'Story / Description'}
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-2 rounded-md outline-none focus:border-cyan transition-colors resize-none leading-[1.6]"
          />
        </div>

        {/* Generate button */}
        <div className="px-4 pb-3">
          <button
            onClick={handleGenerate}
            disabled={status === 'running' || !input.trim()}
            className="w-full text-[10px] font-bold tracking-[1.5px] py-[10px] rounded-md cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: status === 'running' ? 'rgba(59,130,246,.08)' : 'rgba(59,130,246,.12)',
              border:     '1px solid rgba(59,130,246,.3)',
              color:      'var(--cyan)',
            }}
          >
            {status === 'running' ? '⋯ GENERATING…' : '⚡ GENERATE TEST'}
          </button>

          {message && (
            <p
              className="mt-2 text-[10px] text-center font-mono animate-slide-in"
              style={{ color: status === 'error' ? 'var(--red)' : 'var(--green2)' }}
            >
              {message}
            </p>
          )}
        </div>
      </div>

      {/* ── Fixed footer — auto-healer status ─────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border">
        <PanelHeader title="Auto-Healer" />
        <div className="px-4 py-3 space-y-[6px]">
          <div className="flex justify-between items-center">
            <span className="orb-label text-[11px]">Mode</span>
            <span className="text-[11px] text-cyan2">SSE live-stream</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="orb-label text-[11px]">Trigger</span>
            <span className="text-[11px] text-text2">selector fail → Claude → retry</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="orb-label text-[11px]">Cache</span>
            <span className="text-[11px] text-green2">✓ enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
