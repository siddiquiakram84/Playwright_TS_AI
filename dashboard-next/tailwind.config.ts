import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.ts',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-space-mono)', 'Courier New', 'monospace'],
      },
      colors: {
        bg:       'var(--bg)',
        surface:  'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        border:   'var(--border)',
        border2:  'var(--border2)',
        text:     'var(--text)',
        text2:    'var(--text2)',
        muted:    'var(--muted)',
        dim:      'var(--dim)',
        cyan:     'var(--cyan)',
        cyan2:    'var(--cyan2)',
        purple:   'var(--purple)',
        purple2:  'var(--purple2)',
        green:    'var(--green)',
        green2:   'var(--green2)',
        red:      'var(--red)',
        yellow:   'var(--yellow)',
        orange:   'var(--orange)',
        blue:     'var(--blue)',
      },
      gridTemplateColumns: {
        'ai-ops':     '290px 1fr 310px',
        'ai-ops-v2':  '260px 1fr 280px 300px',
        'llm-row':    '18px 115px 80px 1fr 72px 78px',
      },
      keyframes: {
        lPulse:      { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        slideIn:     { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        dPing:       { '0%': { transform: 'scale(1)', opacity: '.7' }, '100%': { transform: 'scale(2.5)', opacity: '0' } },
        budgetPulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.5' } },
      },
      animation: {
        'live-pulse':   'lPulse 1.8s ease-in-out infinite',
        'slide-in':     'slideIn .18s ease-out',
        'dot-ping':     'dPing 2s ease-out infinite',
        'budget-pulse': 'budgetPulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
