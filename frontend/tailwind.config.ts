// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: '#f0f7f4',
          100: '#dcebe3',
          200: '#b8d7c8',
          300: '#8cbdab',
          400: '#5d9d8a',
          500: '#3d7d6b',
          600: '#2d6455',
          700: '#245045',
          800: '#1f4037',
          900: '#1b352e',
        },
        earth: {
          50: '#faf6f1',
          100: '#f4e9dc',
          200: '#e8d3b9',
          300: '#d5b38c',
          400: '#bc8c5d',
          500: '#a6733d',
          600: '#8a5d32',
          700: '#6f4a29',
          800: '#5a3c22',
          900: '#4b321d',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-merriweather)', 'Georgia', 'serif'],
        mono: ['var(--font-fira-code)', 'monospace'],
      },
    },
  },
  plugins: [
    typography,
  ],
}
export default config
