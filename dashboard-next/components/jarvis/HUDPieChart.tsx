'use client';

// ── SVG arc path helper ────────────────────────────────────────────────────────
function arc(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  if (Math.abs(endDeg - startDeg) >= 360) endDeg = startDeg + 359.99;
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// Mid-angle point on an arc for callout lines
function midPoint(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const mid = (startDeg + endDeg) / 2;
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(toRad(mid)),
    y: cy + r * Math.sin(toRad(mid)),
    deg: mid,
  };
}

// ── Segment definition ─────────────────────────────────────────────────────────
interface Segment {
  label:  string;
  value:  number;
  color:  string;
  glow:   string;
}

// ── Callout label ──────────────────────────────────────────────────────────────
function Callout({
  cx, cy, arcR, seg, startDeg, endDeg, pct,
}: {
  cx: number; cy: number; arcR: number;
  seg: Segment; startDeg: number; endDeg: number; pct: number;
}) {
  if (pct < 2) return null;   // skip tiny slices

  const mid   = midPoint(cx, cy, arcR + 22, startDeg, endDeg);
  const outer = midPoint(cx, cy, arcR + 40, startDeg, endDeg);
  const right  = outer.deg > -20 && outer.deg < 200;   // right side of chart
  const lineEndX = outer.x + (right ? 18 : -18);

  return (
    <g>
      {/* radial spoke */}
      <line
        x1={mid.x} y1={mid.y} x2={outer.x} y2={outer.y}
        stroke={seg.color} strokeWidth="0.7" opacity="0.7"
      />
      {/* horizontal tick */}
      <line
        x1={outer.x} y1={outer.y} x2={lineEndX} y2={outer.y}
        stroke={seg.color} strokeWidth="0.7" opacity="0.7"
      />
      {/* dot at junction */}
      <circle cx={outer.x} cy={outer.y} r="1.5" fill={seg.color} opacity="0.8" />
      {/* label */}
      <text
        x={lineEndX + (right ? 2 : -2)}
        y={outer.y - 3}
        textAnchor={right ? 'start' : 'end'}
        fontSize="5.5"
        fontFamily="'Orbitron', monospace"
        fill={seg.color}
        opacity="0.95"
      >
        {seg.label.toUpperCase()}
      </text>
      <text
        x={lineEndX + (right ? 2 : -2)}
        y={outer.y + 5}
        textAnchor={right ? 'start' : 'end'}
        fontSize="6"
        fontFamily="'Orbitron', monospace"
        fontWeight="700"
        fill={seg.color}
        style={{ filter: `drop-shadow(0 0 3px ${seg.color})` }}
      >
        {seg.value} ({pct.toFixed(1)}%)
      </text>
    </g>
  );
}

// ── Main chart ─────────────────────────────────────────────────────────────────
export interface HUDPieChartProps {
  passed:   number;
  failed:   number;
  skipped:  number;
  flaky:    number;
  runs:     number;    // number of history runs aggregated
  label:    string;    // e.g. "THIS WEEK"
}

export default function HUDPieChart({
  passed, failed, skipped, flaky, runs, label,
}: HUDPieChartProps) {
  const CX = 150, CY = 150;
  const INNER_R = 54, ARC_R = 80, SW = 22;

  const total = passed + failed + skipped + flaky;
  const passRate = total > 0 ? (passed / total) * 100 : 0;
  const rateColor = passRate >= 90 ? '#00e89a' : passRate >= 70 ? '#ffd700' : '#ff3d5a';

  const SEGMENTS: Segment[] = [
    { label: 'Passed',  value: passed,  color: '#00e89a', glow: '#00e89a' },
    { label: 'Failed',  value: failed,  color: '#ff3d5a', glow: '#ff3d5a' },
    { label: 'Skipped', value: skipped, color: '#7090a0', glow: '#7090a0' },
    { label: 'Flaky',   value: flaky,   color: '#ffd700', glow: '#ffd700' },
  ].filter(s => s.value > 0);

  // Build arc angles
  let cursor = 0;
  const slices = SEGMENTS.map(seg => {
    const pct  = total > 0 ? (seg.value / total) * 100 : 0;
    const span = (seg.value / Math.max(total, 1)) * 360;
    const start = cursor;
    const end   = cursor + span;
    cursor = end + 2;   // 2° gap between segments
    return { seg, pct, start, end };
  });

  // Tick ring (every 10°)
  const TICK_R = ARC_R + SW / 2 + 10;
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      <svg
        viewBox="0 0 300 300"
        className="w-full h-full"
        style={{ maxWidth: 300, maxHeight: 300 }}
      >
        <defs>
          {/* Central glow filter */}
          <filter id="hud-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Radial gradient for inner circle */}
          <radialGradient id="hud-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(0,40,60,.85)" />
            <stop offset="100%" stopColor="rgba(0,10,20,.95)" />
          </radialGradient>
        </defs>

        {/* ── Outer rotating dashed ring ─────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={ARC_R + SW / 2 + 18}
          fill="none"
          stroke="rgba(0,212,255,.18)"
          strokeWidth="1"
          strokeDasharray="3 7"
          style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'hudSpin 18s linear infinite' }}
        />
        {/* ── Second counter-rotating ring ───────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={ARC_R + SW / 2 + 24}
          fill="none"
          stroke="rgba(0,212,255,.09)"
          strokeWidth="0.6"
          strokeDasharray="1.5 12"
          style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'hudSpin 30s linear infinite reverse' }}
        />

        {/* ── Tick marks ─────────────────────────────────────────────────── */}
        {ticks.map(deg => {
          const rad   = ((deg - 90) * Math.PI) / 180;
          const isMaj = deg % 30 === 0;
          const r1    = TICK_R + (isMaj ? 2 : 0);
          const r2    = r1 + (isMaj ? 5 : 3);
          return (
            <line
              key={deg}
              x1={CX + r1 * Math.cos(rad)} y1={CY + r1 * Math.sin(rad)}
              x2={CX + r2 * Math.cos(rad)} y2={CY + r2 * Math.sin(rad)}
              stroke={isMaj ? 'rgba(0,212,255,.45)' : 'rgba(0,212,255,.18)'}
              strokeWidth={isMaj ? 1 : 0.5}
            />
          );
        })}

        {/* ── Arc track (ghost) ───────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={ARC_R}
          fill="none"
          stroke="rgba(0,212,255,.06)"
          strokeWidth={SW}
        />

        {/* ── Data arc segments ───────────────────────────────────────────── */}
        {total === 0 ? (
          <circle
            cx={CX} cy={CY} r={ARC_R}
            fill="none"
            stroke="rgba(0,212,255,.12)"
            strokeWidth={SW}
          />
        ) : (
          slices.map(({ seg, start, end }) => (
            <path
              key={seg.label}
              d={arc(CX, CY, ARC_R, start, end)}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW}
              strokeLinecap="butt"
              style={{
                filter: `drop-shadow(0 0 6px ${seg.glow}88)`,
                transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)',
              }}
            />
          ))
        )}

        {/* ── Inner glow ring ─────────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={INNER_R + 6}
          fill="none"
          stroke="rgba(0,212,255,.15)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* ── Inner circle background ─────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={INNER_R} fill="url(#hud-bg)" />
        <circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(0,212,255,.2)" strokeWidth="0.8" />

        {/* ── Center: pass rate ───────────────────────────────────────────── */}
        <text
          x={CX} y={CY - 12}
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fontFamily="'Orbitron', monospace"
          fill={rateColor}
          filter="url(#hud-glow)"
        >
          {total > 0 ? `${passRate.toFixed(1)}%` : '—'}
        </text>
        <text
          x={CX} y={CY + 2}
          textAnchor="middle"
          fontSize="5.5"
          fontFamily="'Orbitron', monospace"
          fill="rgba(160,200,220,.65)"
          letterSpacing="1.5"
        >
          PASS RATE
        </text>
        <text
          x={CX} y={CY + 13}
          textAnchor="middle"
          fontSize="8"
          fontFamily="'Orbitron', monospace"
          fill="rgba(0,212,255,.7)"
        >
          {total.toLocaleString()} tests
        </text>
        <text
          x={CX} y={CY + 24}
          textAnchor="middle"
          fontSize="5"
          fontFamily="'Orbitron', monospace"
          fill="rgba(0,212,255,.4)"
          letterSpacing="1"
        >
          {runs} RUN{runs !== 1 ? 'S' : ''}  ·  {label}
        </text>

        {/* ── Callout labels ──────────────────────────────────────────────── */}
        {slices.map(({ seg, pct, start, end }) => (
          <Callout
            key={seg.label}
            cx={CX} cy={CY} arcR={ARC_R + SW / 2}
            seg={seg} startDeg={start} endDeg={end} pct={pct}
          />
        ))}

        {/* ── Corner bracket decorations ──────────────────────────────────── */}
        {[
          [CX - 120, CY - 120, 1, 1],
          [CX + 120, CY - 120, -1, 1],
          [CX - 120, CY + 120, 1, -1],
          [CX + 120, CY + 120, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={x + sx * 12} y2={y}  stroke="rgba(0,212,255,.3)" strokeWidth="1" />
            <line x1={x} y1={y} x2={x} y2={y + sy * 12}  stroke="rgba(0,212,255,.3)" strokeWidth="1" />
          </g>
        ))}
      </svg>

      {/* CSS animations injected inline */}
      <style>{`
        @keyframes hudSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
