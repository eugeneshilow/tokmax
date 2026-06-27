import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://tokmax.vibecoding.tech'),
  title: 'tokenmax — публичный счётчик API-equivalent расхода токенов',
  description:
    'tokenmax считает, во сколько обошёлся бы твой локальный расход Codex и Claude Code по цене API, и публикует счётчик одной командой.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
