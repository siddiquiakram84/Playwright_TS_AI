import { ReactNode } from 'react';

interface PanelProps {
  children:  ReactNode;
  className?: string;
}

export default function Panel({ children, className = '' }: PanelProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden border-r border-border relative ${className}`}
      style={{ background: 'var(--surface)' }}
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
      className={`flex-shrink-0 flex justify-between items-center px-4 py-[9px] border-b border-border ${className}`}
      style={{ background: 'var(--surface2)' }}
    >
      <span className="text-[11px] font-semibold tracking-[.5px] uppercase text-muted">
        {title}
      </span>
      {right}
    </div>
  );
}
