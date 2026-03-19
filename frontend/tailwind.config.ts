import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        leaf: {
          50:  '#f4f4f5', // sidebar bg (zinc-100)
          100: '#ecfdf5', // tag bg (emerald-50)
          200: '#a7f3d0', // tag border (emerald-200)
          300: '#e4e4e7', // standard border (zinc-300)
          400: '#71717a', // muted text (zinc-500)
          500: '#10b981', // primary green (emerald-500)
          600: '#047857', // primary hover (emerald-700)
          700: '#3f3f46', // body text (zinc-700)
          800: '#27272a', // dark text (zinc-800)
          900: '#18181b', // darkest — titles (zinc-900)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'title': ['29px', { lineHeight: '1.2', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
}

export default config
