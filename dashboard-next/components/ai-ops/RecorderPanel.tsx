'use client';

import { useState, useRef } from 'react';
import { PanelHeader } from '@/components/ui/Panel';

const SOURCE_OPTS = [
  { value: 'story',     label: '📝 User Story'   },
  { value: 'nl',        label: '💬 Natural Lang'  },
  { value: 'squishtest',label: '🖥 Squishtest Qt' },
  { value: 'json-tc',   label: '📋 JSON Test Cases'},
  { value: 'txt-tc',    label: '📄 Manual TXT'    },
];

type GenStatus = 'idle' | 'running' | 'done' | 'error';

function StatusDot({ status }: { status: GenStatus }) {
  const map: Record<GenStatus, { cls: string; label: string }> = {
    idle:    { cls: '',             label: 'READY'    },
    running: { cls: 'sdot-pending', label: 'RUNNING'  },
    done:    { cls: '',             label: 'DONE'     },
    error:   { cls: 'sdot-error',   label: 'ERROR'    },
  };
  const { cls, label } = map[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`sdot ${cls}`} />
      <span className="orb text-[9px] tracking-[1px] text-muted">{label}</span>
    </div>
  );
}

export default function RecorderPanel() {
  const [source,   setSource]   = useState('story');
  const [input,    setInput]    = useState('');
  const [status,   setStatus]   = useState<GenStatus>('idle');
  const [message,  setMessage]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const placeholder = {
    story:      'Describe the feature in plain English…\ne.g. "As a user, I can log in with email and password"',
    nl:         'Natural language description of test steps…',
    squishtest: 'Describe the Qt/desktop workflow to test…',
    'json-tc':  'Paste JSON test cases array or upload a .json file…',
    'txt-tc':   'Paste manual test case text or upload a .txt file…',
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
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="Test Generator"
        right={<StatusDot status={status} />}
      />

      {/* Source selector */}
      <div className="px-4 pt-3 pb-2">
        <label className="orb-label block mb-1">Input Type</label>
        <select
          value={source}
          onChange={e => { setSource(e.target.value); setInput(''); }}
          className="w-full bg-surface2 border border-border2 text-text text-[11px] px-3 py-[7px] rounded outline-none focus:border-cyan transition-colors cursor-pointer"
        >
          {SOURCE_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* File upload (json-tc / txt-tc) */}
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
            className="w-full orb text-[9px] tracking-[.5px] py-[7px] rounded cursor-pointer transition-all"
            style={{
              background: 'rgba(0,212,255,.06)',
              border:     '1px dashed rgba(0,212,255,.3)',
              color:      'var(--cyan2)',
            }}
          >
            📁 UPLOAD FILE
          </button>
        </div>
      )}

      {/* Input textarea */}
      <div className="flex-1 px-4 pb-2 min-h-0 flex flex-col">
        <label className="orb-label block mb-1">
          {needsFile ? 'Or paste content below' : 'Story / Description'}
        </label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 w-full bg-surface2 border border-border2 text-text font-mono text-[11px] px-3 py-2 rounded outline-none focus:border-cyan transition-colors resize-none leading-[1.6]"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Generate button */}
      <div className="px-4 pb-3">
        <button
          onClick={handleGenerate}
          disabled={status === 'running' || !input.trim()}
          className="w-full orb text-[10px] font-bold tracking-[2px] py-[11px] rounded cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: status === 'running'
              ? 'rgba(0,212,255,.08)'
              : 'linear-gradient(90deg, rgba(0,212,255,.15) 0%, rgba(157,108,240,.15) 100%)',
            border:     '1px solid rgba(0,212,255,.35)',
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

      {/* Divider + auto-healer status */}
      <div className="h-px mx-4" style={{ background: 'var(--border)' }} />
      <PanelHeader title="Auto-Healer" />
      <div className="px-4 py-3 text-[11px] text-text2 space-y-[6px]">
        <div className="flex justify-between">
          <span className="orb-label">Mode</span>
          <span className="text-cyan2">SSE live-stream</span>
        </div>
        <div className="flex justify-between">
          <span className="orb-label">Trigger</span>
          <span className="text-text2">selector fail → Claude → retry</span>
        </div>
        <div className="flex justify-between">
          <span className="orb-label">Cache</span>
          <span className="text-green2">✓ enabled</span>
        </div>
      </div>

      <div className="flex-1" />
    </div>
  );
}
