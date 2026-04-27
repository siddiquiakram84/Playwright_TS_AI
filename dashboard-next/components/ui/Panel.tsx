import { ReactNode } from 'react';

interface PanelProps {
  children:  ReactNode;
  className?: string;
}

/** Dark panel with corner-bracket decoration and gradient background. */
export default function Panel({ children, className = '' }: PanelProps) {
  return (
    <div
      className={`panel-corners flex flex-col overflow-hidden border-r border-border relative ${className}`}
      style={{ background: 'linear-gradient(175deg, var(--surface) 0%, var(--bg) 100%)' }}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title:     string;
  right?:    ReactNode;
  className?: string;
}

export function PanelHeader({ title, right, className = '' }: PanelHeaderProps) {
  return (
    <div
      className={`panel-hdr-scan flex-shrink-0 flex justify-between items-center px-4 py-[9px] border-b border-border relative overflow-hidden ${className}`}
      style={{ background: 'rgba(0,212,255,.04)' }}
    >
      <span className="orb text-[10px] font-bold tracking-[2px] uppercase text-cyan2">
        {title}
      </span>
      {right}
    </div>
  );
}
