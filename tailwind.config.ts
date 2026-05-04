import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0B0E12',
          900: '#13171D',
          800: '#1B2027',
          700: '#262C35',
          600: '#3A424E',
          500: '#5C6573',
          400: '#8A93A1',
          300: '#B8BFC9',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        ink: {
          50: '#F4F6F8',
          100: '#E6EAEF',
          200: '#C8CFD9',
          300: '#9BA3AE',
          400: '#6E7682',
        },
      },
      fontFamily: {
        display: ['var(--font-inter-tight)', 'Inter Tight', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
