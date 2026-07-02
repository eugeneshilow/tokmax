import { formatCompactNumber, formatInteger, formatUsd } from '@/lib/format'
import { loadTmxProfile } from '@/lib/tmx-profile-live'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'tokmax: API-equivalent usage'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const FONT_DIR = join(process.cwd(), 'lib/og/fonts')

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
        data: readFileSync(join(FONT_DIR, 'inter-cyrillic-600-normal.woff')),
        weight: 600 as const,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: readFileSync(join(FONT_DIR, 'inter-latin-800-normal.woff')),
        weight: 800 as const,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: readFileSync(join(FONT_DIR, 'inter-cyrillic-800-normal.woff')),
        weight: 800 as const,
        style: 'normal' as const,
      },
    ]
  } catch {
    return undefined
  }
}

type TmxOgImageProps = {
  params: Promise<{ nick: string }>
}

export default async function TmxNickOgImage({ params }: TmxOgImageProps) {
  const fonts = loadFonts()
  const { nick: rawNick } = await params
  const nick = rawNick.toLowerCase()
  const profile = await loadTmxProfile(nick)

  const fontFamily = fonts ? 'Inter' : 'sans-serif'

  if (!profile) {
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
            padding: 60,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#FF7A1A' }}>
              tokmax
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#DFFFEA' }}>
              tokmax.dev
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1 }}>
              Measure your token burn
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 20,
                fontSize: 30,
                fontWeight: 600,
                color: '#D2D2D7',
              }}
            >
              Codex + Claude Code · API-equivalent vs subscription
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#18D86B' }}>
            npx tokmax
          </div>
        </div>
      ),
      { ...size, fonts }
    )
  }

  // Rolling last-30-days PROFIT/× (same as the page) — the green dopamine for the share
  // preview. Only when a subscription is known and you're in the green.
  const econ = (() => {
    if (!profile.subscriptionUsd || profile.subscriptionUsd <= 0 || !profile.daily?.length)
      return null
    const lastDate = profile.daily[profile.daily.length - 1].date
    const windowStart = new Date(Date.parse(lastDate) - 29 * 86400000).toISOString().slice(0, 10)
    const windowBurn = profile.daily
      .filter((d) => d.date >= windowStart)
      .reduce((s, d) => s + (d.costUsd ?? 0), 0)
    const sub = profile.subscriptionUsd
    const ratio = sub > 0 ? windowBurn / sub : 0
    return { sub, ratio, profit: windowBurn - sub }
  })()

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
              API-EQUIVALENT
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#DFFFEA' }}>
            tokmax.dev
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 800,
              color: '#A1A1A6',
            }}
          >
            {profile.nick} burned
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 6,
              fontSize: 156,
              fontWeight: 800,
              lineHeight: 0.9,
              color: '#FF7A1A',
            }}
          >
            {formatUsd(profile.costUsd)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              fontSize: 34,
              fontWeight: 600,
              color: '#D2D2D7',
            }}
          >
            at API prices · {formatInteger(profile.totalTokens)} tokens
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {econ && econ.profit >= 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                border: '2px solid rgba(24,216,107,0.55)',
                background: 'rgba(24,216,107,0.12)',
                borderRadius: 16,
                padding: '14px 26px',
              }}
            >
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: '#1BE673' }}>
                +{formatUsd(econ.profit)}
              </div>
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: '#1BE673' }}>
                {econ.ratio.toFixed(1)}×
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: '#9EFFBF' }}>
                  PROFIT · LAST 30 DAYS
                </div>
                <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#9EFFBF' }}>
                  beat your {formatUsd(econ.sub)}/mo plan
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14 }}>
              <OgStat label="TOKENS" value={formatCompactNumber(profile.totalTokens)} />
              <OgStat label="PERIOD" value={`${profile.firstDay} → ${profile.lastDay}`} />
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#18D86B' }}>
            tokmax.dev/{profile.nick}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}

function OgStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid #303035',
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.035)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: '#A1A1A6' }}>
        {label}
      </div>
      <div
        style={{ display: 'flex', marginTop: 6, fontSize: 30, fontWeight: 800, color: '#FFFFFF' }}
      >
        {value}
      </div>
    </div>
  )
}
