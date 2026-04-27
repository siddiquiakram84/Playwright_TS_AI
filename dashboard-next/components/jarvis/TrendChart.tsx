'use client';

import type { HistoryPoint } from '@/types/jarvis';

const W = 100; // viewBox percentage units
const H = 100;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top  - PAD.bottom;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

interface Props {
  history: HistoryPoint[];
}

export default function TrendChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-dim text-[11px]">
        <span className="orb text-[9px] tracking-[1px] text-muted">
          Run at least 2 test sessions to see trend
        </span>
      </div>
    );
  }

  const pts = history.slice(-20);
  const n   = pts.length;

  const maxTotal = Math.max(...pts.map(p => p.total), 1);
  const barW     = (CHART_W / n) * 0.7;
  const gap      = CHART_W / n;

  // Build stacked bars + rate line points
  const barRects: { x: number; passH: number; failH: number; passed: number; failed: number }[] = [];
  const linePoints: string[] = [];

  pts.forEach((p, i) => {
    const cx      = PAD.left + i * gap + gap * 0.15;
    const passH   = (p.passed / maxTotal) * CHART_H;
    const failH   = (p.failed / maxTotal) * CHART_H;
    barRects.push({ x: cx, passH, failH, passed: p.passed, failed: p.failed });

    const lx = PAD.left + i * gap + gap * 0.5;
    const ly = PAD.top + CHART_H - (p.passRate / 100) * CHART_H;
    linePoints.push(`${lx},${ly}`);
  });

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <div className="relative h-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yLabels.map(pct => {
          const y = PAD.top + CHART_H - (pct / 100) * CHART_H;
          return (
            <g key={pct}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="rgba(22,52,80,.5)" strokeWidth="0.4"
                strokeDasharray={pct === 0 ? '0' : '1.5 1.5'}
              />
              <text
                x={PAD.left - 2} y={y + 1.2}
                textAnchor="end" fontSize="4" fill="rgba(80,144,176,.7)"
                fontFamily="monospace"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {barRects.map((b, i) => (
          <g key={i}>
            {/* Pass bar */}
            <rect
              x={b.x} y={PAD.top + CHART_H - b.passH}
              width={barW} height={b.passH}
              fill="rgba(0,232,154,.45)" rx="0.5"
            />
            {/* Fail bar (below pass) */}
            <rect
              x={b.x} y={PAD.top + CHART_H - b.passH - b.failH}
              width={barW} height={b.failH}
              fill="rgba(255,61,90,.45)" rx="0.5"
            />
          </g>
        ))}

        {/* Pass-rate line */}
        <polyline
          points={linePoints.join(' ')}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 2px rgba(0,212,255,.7))' }}
        />

        {/* Rate dots */}
        {linePoints.map((pt, i) => {
          const [x, y] = pt.split(',').map(Number);
          return (
            <circle
              key={i} cx={x} cy={y} r="1"
              fill="var(--cyan)"
              style={{ filter: 'drop-shadow(0 0 2px rgba(0,212,255,.8))' }}
            />
          );
        })}

        {/* X labels (every ~4th point) */}
        {pts.map((p, i) => {
          if (i % Math.max(1, Math.floor(n / 5)) !== 0 && i !== n - 1) return null;
          const cx = PAD.left + i * gap + gap * 0.5;
          return (
            <text
              key={i}
              x={cx} y={H - PAD.bottom + 6}
              textAnchor="middle" fontSize="3.5" fill="rgba(80,144,176,.8)"
              fontFamily="monospace"
            >
              {fmtDate(p.startTime)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute top-1 right-1 flex items-center gap-3 text-[9px] orb tracking-[.5px]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(0,232,154,.55)' }} />
          <span className="text-muted">pass</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(255,61,90,.55)' }} />
          <span className="text-muted">fail</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-px" style={{ background: 'var(--cyan)' }} />
          <span className="text-muted">rate%</span>
        </span>
      </div>
    </div>
  );
}
