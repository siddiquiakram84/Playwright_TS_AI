import type { RunSummary } from '@/types/jarvis';

function fmsDuration(ms: number): string {
  if (ms < 1_000)     return `${ms}ms`;
  if (ms < 60_000)    return `${(ms / 1_000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

interface StatCardProps {
  value:     string;
  label:     string;
  color?:    string;
  glow?:     string;
  sub?:      string;
}

function StatCard({ value, label, color = 'var(--cyan)', glow, sub }: StatCardProps) {
  return (
    <div
      className="panel-corners flex flex-col items-center justify-center py-3 px-4 border rounded relative overflow-hidden transition-all"
      style={{
        background:   'linear-gradient(175deg, var(--surface) 0%, var(--bg) 100%)',
        borderColor:  'var(--border)',
      }}
    >
      {/* Scan shimmer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,212,255,.03), transparent)',
          animation:  'hScan 9s linear infinite',
        }}
      />
      <div
        className="orb text-[26px] font-black leading-none tabular-nums relative"
        style={{ color, textShadow: glow ?? `0 0 12px ${color}55` }}
      >
        {value}
      </div>
      <div className="orb text-[9px] tracking-[1.5px] text-muted uppercase mt-[5px] relative">
        {label}
      </div>
      {sub && (
        <div className="text-[10px] text-dim mt-[2px] relative">{sub}</div>
      )}
    </div>
  );
}

interface Props {
  summary: RunSummary;
}

export default function StatsBar({ summary }: Props) {
  const { total, passed, failed, skipped, flaky, passRate, duration } = summary;

  const rateColor = passRate >= 90 ? 'var(--green)'
                  : passRate >= 70 ? 'var(--yellow)'
                  : 'var(--red)';

  return (
    <div className="grid grid-cols-6 gap-3">
      <StatCard value={String(total)}   label="Total"    color="var(--cyan)"   />
      <StatCard value={String(passed)}  label="Passed"   color="var(--green)"  glow="0 0 12px rgba(0,232,154,.5)" />
      <StatCard value={String(failed)}  label="Failed"   color={failed  > 0 ? 'var(--red)'    : 'var(--dim)'} />
      <StatCard value={String(skipped)} label="Skipped"  color={skipped > 0 ? 'var(--yellow)' : 'var(--dim)'} />
      <StatCard value={String(flaky)}   label="Flaky"    color={flaky   > 0 ? 'var(--orange)' : 'var(--dim)'} />
      <StatCard
        value={`${passRate}%`}
        label="Pass Rate"
        color={rateColor}
        glow={`0 0 16px ${rateColor}55`}
        sub={fmsDuration(duration)}
      />
    </div>
  );
}
