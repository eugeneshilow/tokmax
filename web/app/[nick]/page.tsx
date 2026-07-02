import { AnsiMoney } from '@/components/ansi-money'
import { NpxChip } from '@/components/npx-chip'
import { TerminalCard } from '@/components/terminal-card'
import { MARGINAL_MAX_USD_PER_MO, fable5Countdown, fable5StackMath } from '@/lib/fable5'
import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import {
  FABLE5_LEADERBOARD_LABEL,
  loadTmxProfile,
  loadTmxLeaderboard,
  loadTmxFable5Leaderboard,
  type TmxProfileDaily,
  type TmxProfileSource,
} from '@/lib/tmx-profile-live'
import { PromptCopyBox } from '../prompt-copy-box'
import {
  ArrowUpRight,
  BadgeCheck,
  Flame,
  Gauge,
  ReceiptText,
  ShieldAlert,
  Terminal,
  Zap,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TmxNickPageProps = {
  params: Promise<{ nick: string }>
  searchParams: Promise<{ period?: string }>
}

const SELF_SERVE_ONELINER = 'npx tokmax'
const REPO_URL = 'https://github.com/eugeneshilow/tokmax'
const REPO_DISPLAY = 'github.com/eugeneshilow/tokmax'

// Human-readable date: "2025-09-15" → "Sep 15, 2025" (parsed by parts to avoid TZ shifts).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12) return iso
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

// Period token → human label: "all" | "YYYY" | "YYYY-MM".
function periodLabel(period: string): string {
  if (period === 'all') return 'All-time'
  if (/^\d{4}$/.test(period)) return period
  const [y, m] = period.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return period
  return `${MONTHS[m - 1]} ${y}`
}

export async function generateMetadata({ params }: TmxNickPageProps): Promise<Metadata> {
  const { nick: rawNick } = await params
  const nick = rawNick.toLowerCase()

  const profile = await loadTmxProfile(nick)

  if (!profile) {
    return {
      title: 'Profile not found — tokmax',
    }
  }

  const title = `${profile.nick} burned ${formatUsd(profile.costUsd)} at API prices — tokmax`
  const description = `${profile.nick} burned ${formatCompactNumber(profile.totalTokens)} tokens across Codex + Claude Code — ${formatUsdPrecise(profile.costUsd)} at API prices. ${fmtDate(profile.firstDay)} to ${fmtDate(profile.lastDay)}.`
  const url = `https://tokmax.vibecoding.tech/${profile.nick}`

  return {
    title,
    description,
    alternates: {
      canonical: `/${profile.nick}`,
    },
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function TmxNickPage({ params, searchParams }: TmxNickPageProps) {
  const { nick: rawNick } = await params
  const nick = rawNick.toLowerCase()
  const profile = await loadTmxProfile(nick)

  if (!profile) notFound()

  const { period: rawPeriod } = await searchParams
  const period =
    typeof rawPeriod === 'string' && /^(all|\d{4}|\d{4}-\d{2})$/.test(rawPeriod) ? rawPeriod : 'all'

  const requestedDaily =
    period === 'all' ? profile.daily : profile.daily.filter((d) => d.date.startsWith(period))
  const effectivePeriod = period !== 'all' && requestedDaily.length === 0 ? 'all' : period
  const viewDaily = effectivePeriod === 'all' ? profile.daily : requestedDaily
  const viewCost =
    effectivePeriod === 'all'
      ? profile.costUsd
      : viewDaily.reduce((s, d) => s + (d.costUsd ?? 0), 0)
  const viewTokens =
    effectivePeriod === 'all'
      ? profile.totalTokens
      : viewDaily.reduce((s, d) => s + d.totalTokens, 0)
  const viewFirst = viewDaily.length ? viewDaily[0].date : profile.firstDay
  const viewLast = viewDaily.length ? viewDaily[viewDaily.length - 1].date : profile.lastDay

  const monthSet = new Set<string>()
  const yearSet = new Set<string>()
  for (const d of profile.daily) {
    monthSet.add(d.date.slice(0, 7))
    yearSet.add(d.date.slice(0, 4))
  }
  const monthOptions = [...monthSet].sort().reverse()
  const yearOptions = [...yearSet].sort().reverse()

  const shareUrl = `tokmax.dev/${profile.nick}`
  const peakDay =
    viewDaily.length > 0
      ? viewDaily.reduce((max, day) => (day.totalTokens > max.totalTokens ? day : max))
      : null
  const maxDailyCost = viewDaily.reduce((m, d) => Math.max(m, d.costUsd ?? 0), 0)

  // PROFIT/× = ROLLING LAST 30 DAYS of recorded activity vs ONE month of the current
  // plan (~30 days) — apples-to-apples and STABLE (calendar months tank the ratio in the
  // first days of a month, killing the flex). Window is anchored to the latest data day,
  // so it's "your most recent 30 days of coding". We only need the current plan price, no
  // purchase date / historical-plan guessing.
  const econ = (() => {
    if (!profile.subscriptionUsd || profile.subscriptionUsd <= 0 || profile.daily.length === 0)
      return null
    const lastDate = profile.daily[profile.daily.length - 1].date
    const windowStart = new Date(Date.parse(lastDate) - 29 * 86400000).toISOString().slice(0, 10)
    const windowBurn = profile.daily
      .filter((d) => d.date >= windowStart)
      .reduce((s, d) => s + (d.costUsd ?? 0), 0)
    const sub = profile.subscriptionUsd
    const ratio = sub > 0 ? windowBurn / sub : 0
    return { windowBurn, sub, ratio, profit: windowBurn - sub }
  })()

  const board = await loadTmxLeaderboard(200)
  const rankIdx = board.findIndex((r) => r.nick === profile.nick)
  const rank = rankIdx >= 0 ? rankIdx + 1 : null
  const countdown = fable5Countdown()
  const fable5Usd = profile.fable5LaunchCostUsd ?? 0
  const stackMath = fable5StackMath(fable5Usd)

  // Event rank: position on the Fable 5 window board (separate from all-time).
  const eventBoard = fable5Usd > 0 ? await loadTmxFable5Leaderboard(200) : []
  const eventRankIdx = eventBoard.findIndex((r) => r.nick === profile.nick)
  const eventRank = eventRankIdx >= 0 ? eventRankIdx + 1 : null

  // One-click share: pre-filled post with the numbers. The paste/screenshot IS
  // the viral loop — the button must cost the visitor zero effort.
  const shareText = [
    `I burned ${formatUsd(profile.costUsd)} in AI tokens at API prices` +
      (econ && econ.profit >= 0 ? ` — ${econ.ratio.toFixed(1)}× my plan` : '') +
      '.',
    'See yours: npx tokmax',
    `https://${shareUrl}`,
  ].join('\n')
  const shareIntentHref = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}`

  // Event card gets its own one-click post — the two cards share separately.
  const eventShareText = stackMath
    ? [
        `I burned ${formatUsd(fable5Usd)} on Fable 5 in launch week${eventRank ? ` — #${eventRank} on the board` : ''}.`,
        `Pace says a 2nd Max pays back ${stackMath.secondSubMultiple.toFixed(1)}×. Is one even enough?`,
        'https://tokmax.dev/fable-5',
      ].join('\n')
    : null
  const eventShareIntentHref = eventShareText
    ? `https://x.com/intent/post?text=${encodeURIComponent(eventShareText)}`
    : null

  // English-only copy.
  const t = {
    notVerified: 'figure not verified',
    buildYourOwnCta: 'Build your own',
    asideApiEquivalent: 'api-equivalent',
    asideApiPrice: `${formatUsdPrecise(viewCost)} at API prices`,
    asideTokensTotal: 'total tokens',
    asideTokensCount: `${formatInteger(viewTokens)} tokens`,
    rowPeriod: 'period',
    rowDays: 'days',
    rowCli: 'cli',
    dailyBurnTitle: 'Daily burn ($ at API prices)',
    scoreboardTitle: 'Totals by source',
    buildEyebrow: 'build your own',
    counterTitleLine1: 'Your own counter —',
    counterTitleLine2: 'one command.',
    counterPara:
      'Run one command in your terminal — it reads your local Codex and Claude Code logs, computes the API-equivalent, and publishes your page. Only aggregates leave the box: no keys, no raw logs.',
    howComputed: "How it's computed",
    footerEyebrow: `${profile.nick} · ${fmtDate(viewFirst)} to ${fmtDate(viewLast)}`,
    footerTitle: `${formatUsd(viewCost)} at API prices. Screenshot it and drop it in chat.`,
    statApiEquivalentDetail: 'what this usage would cost at API prices, not on a subscription',
    statTotalTokensLabel: 'Total tokens',
    statTotalTokensDetail: `${formatInteger(viewTokens)} tokens across Codex + Claude Code`,
    statPeriodLabel: 'Period',
    statPeriodDetail: `${fmtDate(viewFirst)} to ${fmtDate(viewLast)} · ${viewDaily.length} days`,
    statPeakLabel: 'Peak day',
    statPeakDetail: peakDay ? `${fmtDate(peakDay.date)}: hottest day` : 'no daily data',
    attribution: 'Prices: LiteLLM · Counting: ccusage',
  }

  const statCards = [
    {
      label: 'API-equivalent',
      value: formatUsdPrecise(viewCost),
      detail: t.statApiEquivalentDetail,
      icon: Flame,
    },
    {
      label: t.statTotalTokensLabel,
      value: formatCompactNumber(viewTokens),
      detail: t.statTotalTokensDetail,
      icon: Gauge,
    },
    {
      label: t.statPeriodLabel,
      value: fmtDate(viewFirst),
      detail: t.statPeriodDetail,
      icon: ReceiptText,
    },
    {
      label: t.statPeakLabel,
      value: peakDay ? formatCompactNumber(peakDay.totalTokens) : '—',
      detail: t.statPeakDetail,
      icon: Zap,
    },
  ]

  function pillClass(active: boolean): string {
    return active
      ? 'inline-flex h-8 items-center rounded-full bg-[#FF7A1A] px-3 font-mono text-[12px] font-bold text-black'
      : 'inline-flex h-8 items-center rounded-full border border-white/20 px-3 font-mono text-[12px] font-bold text-[#D2D2D7] transition-colors hover:border-white/50 hover:text-white'
  }

  return (
    <div className="bg-[#F5F5F7] text-[#1D1D1F] [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-8 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(480px,640px)] lg:gap-10">
          <div className="min-w-0">
            {/* Brand mark: the tool · the project — vibecoding.tech must be screenshot-visible. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[19px] font-black leading-none tracking-tight md:text-[22px]">
                <span className="text-[#FF7A1A]">tokmax</span>
                <span className="mx-2 text-[#5A5A5F]">·</span>
                <span className="text-white">vibecoding.tech</span>
              </span>
              <Badge>API-EQUIVALENT BURN</Badge>
            </div>

            {/* X avatar: verified profiles mirror their X picture + name. */}
            {profile.avatar_url ? (
              <div className="mt-6 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatar_url.replace('_normal', '_400x400')}
                  alt={profile.nick}
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-full border border-white/20 object-cover"
                />
                {profile.verified ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#7DA2FF]">
                    <BadgeCheck className="h-4 w-4" />
                    verified via X
                  </span>
                ) : null}
              </div>
            ) : null}

            {!profile.verified ? (
              <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#9A9AA0]">
                <ShieldAlert className="h-3.5 w-3.5" />
                unverified · anonymous (not signed in with X)
              </div>
            ) : null}

            {/* Compact heading — the giant number now lives in the terminal
                receipt on the right (the Money Terminal screenshot artifact). */}
            <h1 className="mt-6 max-w-4xl text-balance text-[30px] font-black leading-[1.0] tracking-normal text-white sm:text-[38px] lg:text-[44px]">
              {profile.nick} burned{' '}
              <span className="text-[#FF7A1A]">{formatUsd(viewCost)}</span> at API prices.
            </h1>

            {/* Subline: tokens + sources + period. */}
            <p className="mt-5 max-w-3xl text-[16px] font-semibold leading-7 text-[#D2D2D7] md:text-[19px] md:leading-8">
              {formatInteger(viewTokens)} tokens across Codex + Claude Code
              <span className="text-[#6E6E73]"> · </span>
              {fmtDate(viewFirst)} – {fmtDate(viewLast)}
            </p>

            {/* Methodology in the screenshot zone (owner: trust on every screenshot). */}
            <p className="mt-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#8A8A8F]">
              📊 counted with ccusage · priced at LiteLLM API rates
            </p>

            {monthOptions.length > 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#6E6E73]">
                  period
                </span>
                <Link href={`/${profile.nick}?period=all`} className={pillClass(effectivePeriod === 'all')}>
                  {periodLabel('all')}
                </Link>
                {yearOptions.length > 1
                  ? yearOptions.map((y) => (
                      <Link
                        key={y}
                        href={`/${profile.nick}?period=${y}`}
                        className={pillClass(effectivePeriod === y)}
                      >
                        {periodLabel(y)}
                      </Link>
                    ))
                  : null}
                {monthOptions.map((m) => (
                  <Link
                    key={m}
                    href={`/${profile.nick}?period=${m}`}
                    className={pillClass(effectivePeriod === m)}
                  >
                    {periodLabel(m)}
                  </Link>
                ))}
              </div>
            ) : null}

            {profile.suspicious ? (
              <p className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#A1A1A6]">
                <ShieldAlert className="h-4 w-4" />
                {t.notVerified}
              </p>
            ) : null}

            {/* Repo — visible (owner: the GitHub repo must be clearly shown) + attribution. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] font-semibold">
              <Link
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] font-bold text-white transition-colors hover:text-[#FF7A1A]"
              >
                {REPO_DISPLAY}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
              <span className="text-[#5A5A5F]">· open source</span>
              <span className="text-[#6E6E73]">· {t.attribution}</span>
            </div>

            {/* Actions — this is the USER's page: no maker links here, the
                page belongs to the nick (their X link lives on verified rows). */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-[14px] font-bold">
              <Link
                href="/leaderboard"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#FF7A1A]/50 bg-[#FF7A1A]/12 px-4 font-black text-[#FFB877] transition-colors hover:bg-[#FF7A1A]/20"
              >
                Leaderboard
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href={shareIntentHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF7A1A] px-4 font-black text-black transition-colors hover:bg-[#FF954A]"
              >
                Share on X
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <div className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 font-mono text-[13px] text-white">
                {shareUrl}
              </div>
              <Link
                href="#build-your-counter"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#18D86B]/50 bg-[#18D86B]/10 px-4 text-[#B9FFD5] transition-colors hover:bg-[#18D86B]/18"
              >
                {t.buildYourOwnCta}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* The Money Terminal receipt — THE screenshot artifact of the page
              (canon: terminal-card mockup, decision-log 2026-07-02). */}
          <aside className="min-w-0 self-start">
            <TerminalCard title={`${profile.nick} — npx tokmax`} glow>
              <div className="p-5 font-mono text-[13px] leading-relaxed">
                <p>
                  <span className="text-[#6E6E73]">$</span>{' '}
                  <span className="font-bold text-white">npx tokmax</span>
                </p>
                <p className="mt-1 text-[#A1A1A6]">
                  <span className="text-[#18D86B]">✔</span> scanned ·{' '}
                  {profile.machineLabels.length} machine
                  {profile.machineLabels.length === 1 ? '' : 's'} · {viewDaily.length} days · cli{' '}
                  {profile.cliVersion}
                </p>

                {/* Card 1 — the evergreen tokmax receipt. Event content lives
                    in its OWN card below: two clean screenshots, not one mix. */}
                <div className="mt-4 overflow-hidden rounded-lg border border-[#2E2E33]">
                  <div className="border-b border-[#242428] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#A1A1A6]">
                    tokmax · api-equivalent spend
                  </div>
                  <div className="px-4 py-4">
                    <AnsiMoney value={formatUsd(viewCost)} />
                    <p className="mt-3 text-[#A1A1A6]">
                      at API prices · <span className="font-bold text-white">{formatInteger(viewTokens)}</span>{' '}
                      tokens <span className="text-[#6E6E73]">({formatCompactNumber(viewTokens)})</span>
                    </p>
                    <div className="mt-3 space-y-1">
                      {econ && econ.profit >= 0 ? (
                        <p className="font-bold text-[#18D86B]">
                          ▲ +{formatUsd(econ.profit)} profit · {econ.ratio.toFixed(1)}×{' '}
                          <span className="font-normal text-[#6BE39A]">
                            vs your {formatUsd(econ.sub)}/mo plan
                          </span>
                        </p>
                      ) : null}
                      {econ && econ.profit < 0 ? (
                        <p className="text-[#FF7A1A]">
                          🔥 {formatUsd(econ.windowBurn)} of {formatUsd(econ.sub)}/mo plan · room to
                          burn
                        </p>
                      ) : null}
                      {effectivePeriod === 'all' && rank ? (
                        <p className="text-white">
                          🏆 <span className="font-bold">#{rank}</span> on the leaderboard
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#242428] px-4 py-2">
                    <span>
                      <span className="text-[#6E6E73]">your page → </span>
                      <span className="font-bold text-[#FF7A1A]">{shareUrl}</span>
                    </span>
                    <NpxChip />
                  </div>
                </div>

                <p className="mt-3 text-[12px] text-[#6E6E73]">
                  ⌘⇧4 — screenshot a card. They&apos;re built for it.
                </p>
              </div>
            </TerminalCard>

            {/* Card 2 — Fable 5 Week: strictly the event window. Its own
                terminal, its own share link — shareable on its own. */}
            {fable5Usd > 0 && stackMath ? (
              <TerminalCard title={`${profile.nick} — fable-5 week`} glow className="mt-6">
                <div className="p-5 font-mono text-[13px] leading-relaxed">
                  <div className="overflow-hidden rounded-lg border border-[#2E2E33]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#242428] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                      <span className="font-black text-[#FF7A1A]">
                        fable 5 week · {FABLE5_LEADERBOARD_LABEL}
                      </span>
                      <span className="shrink-0 text-[#A1A1A6]">
                        {countdown.over
                          ? 'final results'
                          : `day ${countdown.day}/7 · ${countdown.daysLeft} day${countdown.daysLeft === 1 ? '' : 's'} left`}
                      </span>
                    </div>
                    <div className="px-4 py-4">
                      <AnsiMoney value={formatUsd(fable5Usd)} />
                      <p className="mt-3 text-[#A1A1A6]">
                        on Fable 5 this week ·{' '}
                        <span className="font-bold text-white">
                          {formatInteger(profile.fable5LaunchTokens ?? 0)}
                        </span>{' '}
                        tokens
                      </p>
                      <div className="mt-3 space-y-1">
                        {eventRank ? (
                          <p className="text-white">
                            🏆 <span className="font-bold">#{eventRank}</span> on the launch board
                          </p>
                        ) : null}
                        <p className="text-[#D2D2D7]">
                          ⚖️{' '}
                          <span className="font-bold text-white">
                            {formatUsd(stackMath.weeklyRateUsd)}/wk
                          </span>{' '}
                          pace · 2nd Max (${MARGINAL_MAX_USD_PER_MO}/mo) pays back{' '}
                          <span className="font-bold text-[#18D86B]">
                            {stackMath.secondSubMultiple.toFixed(1)}×
                          </span>{' '}
                          <span className="text-[#6E6E73]">if you&apos;re capped</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#242428] px-4 py-2">
                      <span>
                        <span className="text-[#6E6E73]">board → </span>
                        <Link href="/fable-5" className="font-bold text-[#FF7A1A] hover:underline">
                          tokmax.dev/fable-5
                        </Link>
                      </span>
                      <NpxChip />
                    </div>
                  </div>

                  {eventShareIntentHref ? (
                    <p className="mt-3 text-[12px] text-[#6E6E73]">
                      →{' '}
                      <a
                        href={eventShareIntentHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF7A1A] underline decoration-dotted underline-offset-4 hover:text-[#FF954A]"
                      >
                        post the week
                      </a>{' '}
                      — pre-filled with your numbers
                    </p>
                  ) : null}
                </div>
              </TerminalCard>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="border-b border-[#D2D2D7] bg-white">
        <div className="mx-auto grid max-w-[1680px] gap-px border-x border-[#D2D2D7] bg-[#D2D2D7] md:grid-cols-4">
          {statCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {viewDaily.length > 0 ? (
        <section className="border-b border-[#D2D2D7] bg-[#F5F8FC]">
          <div className="mx-auto max-w-[1680px] px-4 py-6 md:px-6">
            <SectionHeader
              eyebrow="daily burn"
              title={t.dailyBurnTitle}
              right={
                <>
                  <span className="text-[#3861FB]">Codex</span> /{' '}
                  <span className="text-[#FF7A1A]">Claude Code</span> / Total
                </>
              }
            />
            <div className="mt-4 grid gap-2">
              {[...viewDaily].reverse().map((day) => (
                <DailyBar key={day.date} day={day} max={maxDailyCost} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-[1680px] px-4 py-6 md:px-6">
        <div className="min-w-0 self-start border border-[#D2D2D7] bg-white">
          <SectionHeader
            eyebrow="scoreboard"
            title={t.scoreboardTitle}
            right="API estimate"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-[#F5F5F7] text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
                <tr>
                  <th className="border-y border-[#D2D2D7] px-4 py-3">Source</th>
                  <th className="border-y border-[#D2D2D7] px-4 py-3 text-right">Input</th>
                  <th className="border-y border-[#D2D2D7] px-4 py-3 text-right">Output</th>
                  <th className="border-y border-[#D2D2D7] px-4 py-3 text-right">Cache</th>
                  <th className="border-y border-[#D2D2D7] px-4 py-3 text-right">Total</th>
                  <th className="border-y border-[#D2D2D7] px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="text-[14px] font-semibold">
                {profile.sources.map((source) => (
                  <SourceRow key={source.source} source={source} />
                ))}
                <tr className="bg-[#1D1D1F] text-white">
                  <td className="px-4 py-4 font-black">Total</td>
                  <td className="px-4 py-4 text-right">{formatInteger(profile.totals.input)}</td>
                  <td className="px-4 py-4 text-right">{formatInteger(profile.totals.output)}</td>
                  <td className="px-4 py-4 text-right">
                    {formatInteger(profile.totals.cacheCreate + profile.totals.cacheRead)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {formatInteger(profile.totals.totalTokens)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {formatUsdPrecise(profile.totals.costUsd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        id="build-your-counter"
        className="border-t border-[#242428] bg-[#070707] text-white"
      >
        <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-6 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#18D86B]">
                {t.buildEyebrow}
              </p>
              <h2 className="mt-3 max-w-3xl text-[34px] font-black leading-[0.98] md:text-[52px]">
                {t.counterTitleLine1}
                <br />
                {t.counterTitleLine2}
              </h2>
              <p className="mt-5 max-w-2xl text-[16px] font-semibold leading-7 text-[#D2D2D7]">
                {t.counterPara}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-[14px] font-bold">
                <Link
                  href="/"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[#070707] transition-colors hover:bg-[#E8E8ED]"
                >
                  <Terminal className="h-4 w-4" />
                  {t.howComputed}
                </Link>
              </div>
            </div>

            <PromptCopyBox prompt={SELF_SERVE_ONELINER} />

            {/* Manage this page — clearly state how to stop the daily update or delete it. */}
            <div className="mt-6 rounded-xl border border-white/14 bg-[#0E0E0E] p-5">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#A1A1A6]">
                manage this page
              </p>
              <p className="mt-2 text-[14px] font-semibold leading-6 text-[#D2D2D7]">
                Your call, any time — run it in your terminal:
              </p>
              <div className="mt-3 grid gap-2 font-mono text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <code className="rounded border border-[#18D86B]/50 bg-[#18D86B]/10 px-2 py-1 font-bold text-[#18D86B]">
                    npx tokmax update
                  </code>
                  <span className="text-[#8A8A8F]">refresh these numbers right now</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <code className="rounded bg-white/10 px-2 py-1 font-bold text-white">
                    npx tokmax daily off
                  </code>
                  <span className="text-[#8A8A8F]">stop the daily auto-update on a machine</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <code className="rounded bg-white/10 px-2 py-1 font-bold text-white">
                    npx tokmax delete
                  </code>
                  <span className="text-[#8A8A8F]">permanently remove this page + your account</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D2D2D7] bg-white">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-7 md:flex-row md:items-end md:justify-between md:px-6">
          <div>
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
              {t.footerEyebrow}
            </p>
            <h2 className="mt-2 text-[28px] font-black leading-tight">
              {t.footerTitle}
            </h2>
            <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#6E6E73]">
              {t.attribution}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-black">
            <span className="rounded-lg bg-[#1A1206] px-3 py-2 text-[#FF7A1A]">
              {formatUsdPrecise(viewCost)}
            </span>
            <span className="rounded-lg border border-[#D2D2D7] px-3 py-2">{shareUrl}</span>
            <span className="rounded-lg bg-[#1D1D1F] px-3 py-2 text-white">tokmax</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-white/18 px-3 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#D2D2D7]">
      {children}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Gauge
}) {
  return (
    <div className="min-h-[156px] bg-white p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
          {label}
        </p>
        <Icon className="h-4.5 w-4.5 text-[#3861FB]" />
      </div>
      <p className="mt-5 text-[34px] font-black leading-none tracking-normal md:text-[40px]">
        {value}
      </p>
      <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6E6E73]">{detail}</p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string
  title: string
  right: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#D2D2D7] px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[22px] font-black leading-none">{title}</h2>
      </div>
      <p className="font-mono text-[12px] font-bold text-[#6E6E73]">{right}</p>
    </div>
  )
}

function SourceRow({ source }: { source: TmxProfileSource }) {
  return (
    <tr className="border-b border-[#D2D2D7]">
      <td className="px-4 py-4 font-black">{source.source}</td>
      <td className="px-4 py-4 text-right">{formatInteger(source.input)}</td>
      <td className="px-4 py-4 text-right">{formatInteger(source.output)}</td>
      <td className="px-4 py-4 text-right">
        {formatInteger(source.cacheCreate + source.cacheRead)}
      </td>
      <td className="px-4 py-4 text-right">{formatInteger(source.totalTokens)}</td>
      <td className="px-4 py-4 text-right">{formatUsdPrecise(source.costUsd)}</td>
    </tr>
  )
}

function DailyBar({ day, max }: { day: TmxProfileDaily; max: number }) {
  // Bar length = daily $ (API-equivalent); the inner split still shows the
  // Codex/Claude token mix as a proportion.
  const cost = day.costUsd ?? 0
  const width = max > 0 ? Math.max(1, Math.round((cost / max) * 100)) : 1
  const codexWidth = day.totalTokens > 0 ? Math.round((day.codexTokens / day.totalTokens) * 100) : 0

  return (
    <div className="grid gap-2 border border-[#D2D2D7] bg-white p-3 md:grid-cols-[116px_1fr_140px] md:items-center">
      <p className="font-mono text-[13px] font-black">{fmtDate(day.date)}</p>
      <div className="h-8 bg-[#F5F5F7]">
        <div className="flex h-8" style={{ width: `${width}%` }}>
          <div className="h-8 bg-[#3861FB]" style={{ width: `${codexWidth}%` }} />
          <div className="h-8 flex-1 bg-[#FF7A1A]" />
        </div>
      </div>
      <div className="md:text-right">
        <div className="text-[15px] font-black text-[#FF7A1A]">{formatUsd(cost)}</div>
        <div className="text-[11px] font-semibold text-[#6E6E73]">
          {formatCompactNumber(day.totalTokens)} tokens
        </div>
      </div>
    </div>
  )
}
