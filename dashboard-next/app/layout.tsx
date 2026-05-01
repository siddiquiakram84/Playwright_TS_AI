import type { Metadata } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

const spaceMono = Space_Mono({
  subsets:  ['latin'],
  variable: '--font-space-mono',
  weight:   ['400', '700'],
  display:  'swap',
});

export const metadata: Metadata = {
  title: 'AI OPS — Operations Dashboard',
  description: 'Real-time LLM operations dashboard for the Playwright AI framework',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body className="h-screen overflow-hidden bg-bg text-text flex flex-col">
        <nav
          className="relative z-20 flex-shrink-0 flex items-center gap-1 px-4 border-b"
          style={{ height: 32, background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <a href="/ai-ops" className="nav-link">AI OPS</a>
          <a href="/jarvis" className="nav-link">JARVIS</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
