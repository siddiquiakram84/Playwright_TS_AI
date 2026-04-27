import type { Metadata } from 'next';
import { Orbitron, Space_Mono } from 'next/font/google';
import Canvas from '@/components/ui/Canvas';
import './globals.css';

const orbitron = Orbitron({
  subsets:  ['latin'],
  variable: '--font-orbitron',
  weight:   ['400', '600', '700', '900'],
  display:  'swap',
});

const spaceMono = Space_Mono({
  subsets:  ['latin'],
  variable: '--font-space-mono',
  weight:   ['400', '700'],
  display:  'swap',
});

export const metadata: Metadata = {
  title: 'AI OPS — Command Center',
  description: 'Real-time LLM operations dashboard for the Playwright AI framework',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${spaceMono.variable}`}>
      <body className="h-screen overflow-hidden bg-bg text-text font-mono flex flex-col">
        <Canvas />
        <div className="scanlines" />
        <div className="vignette" />
        <nav
          className="relative z-20 flex-shrink-0 flex items-center gap-1 px-4 border-b"
          style={{ height: 30, background: 'rgba(2,8,16,.85)', borderColor: 'var(--border)' }}
        >
          <a href="/ai-ops" className="nav-link">AI OPS</a>
          <a href="/jarvis" className="nav-link">JARVIS</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
