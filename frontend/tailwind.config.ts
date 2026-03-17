import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        leaf: {
          50:  '#f0f3ed', // sidebar bg
          100: '#edf5e8', // tag bg / lightest tint
          200: '#c5ddb8', // tag border / soft border
          300: '#dce5d7', // standard border
          400: '#8fa898', // muted text
          500: '#3d8c52', // primary green
          600: '#2d7042', // primary hover
          700: '#374f42', // body text
          800: '#1e3d2e', // dark text
          900: '#1a3828', // darkest — titles
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
