/**
 * Leaf frontend: Next.js root layout (`frontend/src/app/layout.tsx`).
 *
 * Purpose:
 * - Defines the global HTML shell and exported `metadata` for the whole app.
 * - Sets up Geist, Geist Mono, and campaign fonts (Cinzel, Cinzel Decorative, Crimson Pro) via `next/font`.
 *
 * How to read:
 * - Look at the `metadata` export first (title/description).
 * - Then check the `RootLayout` component: it renders the `<html>` and `<body>` tags.
 *
 * Update:
 * - To change global fonts, update the `next/font/local` blocks in this file. Campaign `.woff2` files are vendored in `public/fonts/` (refresh via `npm run fonts` if you bump URLs in `scripts/download-fonts.js`).
 * - To change page-wide styling, adjust the `<body>` className or related global CSS (`globals.css`).
 *
 * Debug:
 * - If styling/layout changes don’t apply, confirm `globals.css` is imported here and that the font variables are used.
 * - Use Next.js dev overlay to spot hydration or layout errors.
 */


import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import localFont from 'next/font/local'
import { DesignThemeProvider } from '@/components/DesignThemeProvider'
import { DesignThemeScript } from '@/components/DesignThemeScript'
import './globals.css'

const geistSans = GeistSans
const geistMono = GeistMono

const cinzel = localFont({
  src: '../../public/fonts/cinzel.woff2',
  variable: '--font-cinzel',
  weight: '400 700',
})

const cinzelDecorative = localFont({
  src: [
    { path: '../../public/fonts/cinzel-decorative-400.woff2', weight: '400' },
    { path: '../../public/fonts/cinzel-decorative-700.woff2', weight: '700' },
  ],
  variable: '--font-cinzel-decorative',
})

const crimsonPro = localFont({
  src: [
    { path: '../../public/fonts/crimson-pro-normal.woff2', weight: '400 600', style: 'normal' },
    { path: '../../public/fonts/crimson-pro-italic.woff2', weight: '400 600', style: 'italic' },
  ],
  variable: '--font-crimson',
})

export const metadata: Metadata = {
  title: 'Leaf',
  description: 'A markdown editor for your ideas',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const fontVars = [
    geistSans.variable,
    geistMono.variable,
    cinzel.variable,
    cinzelDecorative.variable,
    crimsonPro.variable,
  ].join(' ')

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DesignThemeScript />
      </head>
      <body className={`${fontVars} antialiased`}>
        <DesignThemeProvider>{children}</DesignThemeProvider>
      </body>
    </html>
  )
}
