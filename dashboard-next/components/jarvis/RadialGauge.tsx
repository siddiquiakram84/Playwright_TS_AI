'use client';

interface Props {
  value:    number;   // 0-100 pass rate
  passed:   number;
  failed:   number;
  total:    number;
  duration: string;
}

const R  = 80;
const CX = 110;
const CY = 110;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function RadialGauge({ value, passed, failed, total, duration }: Props) {
  const pct      = Math.min(100, Math.max(0, value));
  const dashFill = (pct / 100) * CIRCUMFERENCE;
  const color    = pct >= 90 ? '#00e89a' : pct >= 70 ? '#ffd700' : '#ff3d5a';
  const trackClr = 'rgba(255,255,255,.05)';

  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      <svg
        viewBox="0 0 220 220"
        className="w-full h-full"
        style={{ maxWidth: 260, maxHeight: 260 }}
      >
        {/* Outer decorative ring */}
        <circle
          cx={CX} cy={CY} r={R + 14}
          fill="none"
          stroke="rgba(0,212,255,.07)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Track */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={trackClr}
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Value arc */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dashFill} ${CIRCUMFERENCE - dashFill}`}
          strokeDashoffset={CIRCUMFERENCE * 0.25}
          style={{
            filter:     `drop-shadow(0 0 8px ${color}88)`,
            transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)',
          }}
        />

        {/* Tick marks (12 ticks) */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * 360 - 90;
          const rad   = (angle * Math.PI) / 180;
          const r1    = R + 18, r2 = R + 22;
          return (
            <line
              key={i}
              x1={CX + r1 * Math.cos(rad)} y1={CY + r1 * Math.sin(rad)}
              x2={CX + r2 * Math.cos(rad)} y2={CY + r2 * Math.sin(rad)}
              stroke="rgba(0,212,255,.35)"
              strokeWidth="1"
            />
          );
        })}

        {/* Inner glow circle */}
        <circle
          cx={CX} cy={CY} r={R - 22}
          fill="rgba(0,0,0,.4)"
          stroke="rgba(0,212,255,.08)"
          strokeWidth="1"
        />

        {/* Pass rate value */}
        <text
          x={CX} y={CY - 10}
          textAnchor="middle"
          fontSize="32"
          fontWeight="900"
          fontFamily="'Orbitron', monospace"
          fill={color}
          style={{ filter: `drop-shadow(0 0 10px ${color}99)` }}
        >
          {pct.toFixed(1)}%
        </text>

        {/* Label */}
        <text
          x={CX} y={CY + 12}
          textAnchor="middle"
          fontSize="7"
          fontFamily="'Orbitron', monospace"
          fill="rgba(160,200,220,.6)"
          letterSpacing="2"
        >
          PASS RATE
        </text>

        {/* Duration */}
        <text
          x={CX} y={CY + 25}
          textAnchor="middle"
          fontSize="9"
          fontFamily="'Orbitron', monospace"
          fill="rgba(0,212,255,.55)"
        >
          {duration}
        </text>

        {/* Bottom stat pills: passed / total / failed */}
        <g transform={`translate(${CX}, ${CY + 50})`}>
          {/* Passed */}
          <rect x={-62} y={-9} width={38} height={18} rx="3" fill="rgba(0,232,154,.12)" stroke="rgba(0,232,154,.3)" strokeWidth="0.8" />
          <text x={-43} y={4} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="'Orbitron',monospace" fill="#00e89a">{passed}</text>

          {/* Total */}
          <rect x={-16} y={-9} width={32} height={18} rx="3" fill="rgba(0,212,255,.08)" stroke="rgba(0,212,255,.2)" strokeWidth="0.8" />
          <text x={0} y={4} textAnchor="middle" fontSize="8.5" fontFamily="'Orbitron',monospace" fill="rgba(0,212,255,.8)">{total}</text>

          {/* Failed */}
          <rect x={19} y={-9} width={38} height={18} rx="3" fill="rgba(255,61,90,.12)" stroke="rgba(255,61,90,.3)" strokeWidth="0.8" />
          <text x={38} y={4} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="'Orbitron',monospace" fill="#ff3d5a">{failed}</text>
        </g>
      </svg>
    </div>
  );
}
