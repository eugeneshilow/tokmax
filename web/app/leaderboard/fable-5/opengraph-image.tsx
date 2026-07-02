import { fable5Countdown } from '@/lib/fable5'
import { formatUsd } from '@/lib/format'
import { loadTmxFable5Leaderboard } from '@/lib/tmx-profile-live'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Fable 5 launch leaderboard — tokmax'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const FONT_DIR = join(process.cwd(), 'lib/og/fonts')
const MEDALS = ['🥇', '🥈', '🥉']

function loadFonts() {
  try {
    return [
      {
        name: 'Inter',
        data: readFileSync(join(FONT_DIR, 'inter-latin-600-normal.woff')),
        weight: 600 as const,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: readFileSync(join(FONT_DIR, 'inter-latin-800-normal.woff')),
        weight: 800 as const,
        style: 'normal' as const,
      },
    ]
  } catch {
    return undefined
  }
}

export default async function Fable5BoardOgImage() {
  const fonts = loadFonts()
  const fontFamily = fonts ? 'Inter' : 'sans-serif'
  const rows = (await loadTmxFable5Leaderboard(3)) ?? []
  const totalSpend = rows.reduce((sum, row) => sum + row.fable5CostUsd, 0)
  const countdown = fable5Countdown()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #030403 0%, #070707 58%, #1A0E03 100%)',
          color: '#FFFFFF',
          fontFamily,
          padding: 56,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 46,
                border: '2px solid #303035',
                borderRadius: 999,
                padding: '0 22px',
                background: 'rgba(255,255,255,0.035)',
                color: '#D2D2D7',
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              tokmax
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 46,
                border: '2px solid #FF7A1A',
                borderRadius: 999,
                padding: '0 22px',
                background: 'rgba(255,122,26,0.12)',
                color: '#FFC79A',
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {countdown.over
                ? 'FABLE 5 · FINAL RESULTS'
                : `FABLE 5 · DAY ${countdown.day}/7 · ${countdown.daysLeft} DAYS LEFT`}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: '#A1A1A6' }}>
            tokmax.dev
          </div>
        </div>

        <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, lineHeight: 1 }}>
              Who burns the most
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 58,
                fontWeight: 800,
                lineHeight: 1.15,
                color: '#A1A1A6',
              }}
            >
              on Fable 5?
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 30,
              }}
            >
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: '#A1A1A6' }}>
                BURNED SO FAR, TOGETHER
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 84,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: '#FF7A1A',
                }}
              >
                {formatUsd(totalSpend)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 470 }}>
            {rows.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: '2px solid #303035',
                  borderRadius: 16,
                  padding: '26px 28px',
                  background: 'rgba(255,255,255,0.035)',
                }}
              >
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>
                  The board is open.
                </div>
                <div
                  style={{
                    display: 'flex',
                    marginTop: 10,
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#D2D2D7',
                  }}
                >
                  First publish takes #1 — July 1-7 only.
                </div>
              </div>
            ) : (
              rows.map((row, i) => (
                <div
                  key={row.nick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: i === 0 ? '2px solid #FF7A1A' : '2px solid #303035',
                    borderRadius: 14,
                    padding: '16px 22px',
                    background: i === 0 ? 'rgba(255,122,26,0.10)' : 'rgba(255,255,255,0.035)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', fontSize: 30 }}>{MEDALS[i] ?? `#${i + 1}`}</div>
                    <div style={{ display: 'flex', fontSize: 28, fontWeight: 800 }}>{row.nick}</div>
                  </div>
                  <div
                    style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#FF7A1A' }}
                  >
                    {formatUsd(row.fable5CostUsd)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 54,
              border: '2px solid rgba(24,216,107,0.55)',
              background: 'rgba(24,216,107,0.10)',
              borderRadius: 12,
              padding: '0 24px',
              fontSize: 26,
              fontWeight: 800,
              color: '#1BE673',
            }}
          >
            $ npx tokmax — 30 seconds to enter
          </div>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: '#A1A1A6' }}>
            API-equivalent $ · July 1-7, 2026 only
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
