/**
 * Leaf frontend: Next.js root layout (`frontend/src/app/layout.tsx`).
 *
 * Purpose:
 * - Defines the global HTML shell and exported `metadata` for the whole app.
 * - Sets up the Geist/Geist Mono fonts via `next/font`.
 *
 * How to read:
 * - Look at the `metadata` export first (title/description).
 * - Then check the `RootLayout` component: it renders the `<html>` and `<body>` tags.
 *
 * Update:
 * - To change global fonts, update the `Geist(...)` and `Geist_Mono(...)` blocks.
 * - To change page-wide styling, adjust the `<body>` className or related global CSS (`globals.css`).
 *
 * Debug:
 * - If styling/layout changes don’t apply, confirm `globals.css` is imported here and that the font variables are used.
 * - Use Next.js dev overlay to spot hydration or layout errors.
 */


import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
