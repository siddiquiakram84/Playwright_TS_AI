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
        orbitron:  ['var(--font-orbitron)', 'sans-serif'],
        mono:      ['var(--font-space-mono)', 'Courier New', 'monospace'],
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
        'ai-ops':    '290px 1fr 310px',
        'llm-row':   '18px 115px 80px 1fr 72px 78px',
      },
      keyframes: {
        hexSpin:   { '0%,100%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(360deg)' } },
        lPulse:    { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '.45', transform: 'scale(1.4)' } },
        slideIn:   { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        dPing:     { '0%': { transform: 'scale(1)', opacity: '.7' }, '100%': { transform: 'scale(3)', opacity: '0' } },
        hScan:     { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(500%)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        budgetPulse: {
          '0%,100%': { textShadow: '0 0 10px rgba(255,61,90,.7), 0 0 30px rgba(255,61,90,.3)' },
          '50%':     { textShadow: '0 0 20px rgba(255,61,90,1), 0 0 50px rgba(255,61,90,.5)' },
        },
      },
      animation: {
        'hex-spin':    'hexSpin 10s ease-in-out infinite',
        'live-pulse':  'lPulse 1.8s ease-in-out infinite',
        'slide-in':    'slideIn .2s ease-out',
        'dot-ping':    'dPing 2s ease-out infinite',
        'h-scan':      'hScan 9s linear infinite',
        'shimmer':     'shimmer 3s linear infinite',
        'budget-pulse':'budgetPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
