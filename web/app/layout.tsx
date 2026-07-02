import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
})

// Brand mono: the face of a terminal-first brand must not depend on the
// visitor's OS mono font (Money Terminal art direction, decision-log 2026-07-02).
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://tokmax.vibecoding.tech'),
  title: 'tokmax — your public API-equivalent token-burn meter',
  description:
    'tokmax measures what your local Codex and Claude Code usage would cost at API prices, and publishes the meter with one command.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
