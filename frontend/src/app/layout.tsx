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
 * - To change global fonts, update the `next/font/google` blocks in this file.
 * - To change page-wide styling, adjust the `<body>` className or related global CSS (`globals.css`).
 *
 * Debug:
 * - If styling/layout changes don’t apply, confirm `globals.css` is imported here and that the font variables are used.
 * - Use Next.js dev overlay to spot hydration or layout errors.
 */


import type { Metadata } from 'next'
import { Cinzel, Cinzel_Decorative, Crimson_Pro, Geist, Geist_Mono } from 'next/font/google'
import { DesignThemeProvider } from '@/components/DesignThemeProvider'
import { DesignThemeScript } from '@/components/DesignThemeScript'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700'],
})

const cinzelDecorative = Cinzel_Decorative({
  subsets: ['latin'],
  variable: '--font-cinzel-decorative',
  weight: ['400', '700'],
})

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
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
