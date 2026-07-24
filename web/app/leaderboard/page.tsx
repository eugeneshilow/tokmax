import { TerminalCard } from '@/components/terminal-card'
import { formatCompactNumber, formatUsd, formatUsdPrecise } from '@/lib/format'
import {
  loadTmxLeaderboardByPeriod,
  type TmxLeaderboardAgent,
} from '@/lib/tmx-profile-live'
import { PromptCopyBox } from '../prompt-copy-box'
import { ArrowUpRight, Flame, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELF_SERVE_ONELINER = 'npx tokmax'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type PeriodOption = { value: string; label: string }
type AgentOption = { value: TmxLeaderboardAgent; label: string }

const AGENT_OPTIONS: AgentOption[] = [
  { value: 'all', label: 'All' },
  { value: 'codex', label: 'Codex' },
  { value: 'claude-code', label: 'Claude Code' },
]

/** YYYY-MM for a Date (UTC, so the period matches the daily[] date strings). */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Human label for any period token: "all" | "YYYY" | "YYYY-MM". */
function periodLabel(period: string): string {
  if (period === 'all') return 'All-time'
  if (/^\d{4}$/.test(period)) return period
  const [y, m] = period.split('-')
  const idx = Number(m) - 1
  return `${MONTH_NAMES[idx] ?? m} ${y}`
}

function agentLabel(agent: TmxLeaderboardAgent): string {
  return AGENT_OPTIONS.find((option) => option.value === agent)?.label ?? 'All'
}

function leaderboardHref(period: string, agent: TmxLeaderboardAgent): string {
  const params = new URLSearchParams({ period })
  if (agent !== 'all') params.set('agent', agent)
  return `/leaderboard?${params.toString()}`
}

/**
 * Selectable periods: current + previous month, current year, all-time.
 * Deliberately collapsed from 6 months × 2 years — with a young board most
 * pills led to "No one on the board" dead-ends. Unknown ?period values fall
 * back to the current month.
 */
function buildPeriodOptions(now: Date): {
  current: string
  months: PeriodOption[]
  years: PeriodOption[]
} {
  const current = monthKey(now)
  const months: PeriodOption[] = []
  for (let i = 0; i < 2; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const value = monthKey(d)
    months.push({ value, label: periodLabel(value) })
  }
  const years: PeriodOption[] = [{ value: String(now.getUTCFullYear()), label: String(now.getUTCFullYear()) }]
  return { current, months, years }
}

export async function generateMetadata(): Promise<Metadata> {
  const title = 'tokmax leaderboard — who burned the most at API prices'
  const description =
    'Ranked by API-equivalent $: how much each person burned across Codex + Claude Code at API prices — by month, by year, or all-time.'
  return {
    title,
    description,
    alternates: { canonical: '/leaderboard' },
    openGraph: { title, description, url: 'https://tokmax.vibecoding.tech/leaderboard', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TmxLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string | string[]
    agent?: string | string[]
  }>
}) {
  const now = new Date()
  const { current, months, years } = buildPeriodOptions(now)
  const params = await searchParams

  // Allowed periods = the selectable set + all-time. Anything else (or none)
  // falls back to the CURRENT calendar month (the default view).
  const allowed = new Set<string>(['all', ...months.map((m) => m.value), ...years.map((y) => y.value)])
  const rawPeriod = params?.period
  const requested = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod
  const period = requested && allowed.has(requested) ? requested : current

  const rawAgent = params?.agent
  const requestedAgent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent
  const agent: TmxLeaderboardAgent = AGENT_OPTIONS.some(
    (option) => option.value === requestedAgent
  )
    ? (requestedAgent as TmxLeaderboardAgent)
    : 'all'

  const rows = await loadTmxLeaderboardByPeriod(period, 100, agent)
  const label = periodLabel(period)
  const selectedAgentLabel = agentLabel(agent)

  const t = {
    eyebrow: 'leaderboard',
    title: `Who burned the most — ${label}.`,
    sub:
      agent === 'all'
        ? 'Ranked by API-equivalent $ — what your Codex + Claude Code usage would cost at API prices. Pick a month, a year, all-time, or one AI agent.'
        : `Ranked by ${selectedAgentLabel} API-equivalent $ at API prices. Pick a month, a year, all-time, or another AI agent.`,
    rank: '#',
    nick: 'nick',
    api: 'API-equivalent',
    tokens: 'tokens',
    machines: 'machines',
    empty:
      agent === 'all'
        ? `No one on the board for ${label} yet — be the first.`
        : `No ${selectedAgentLabel} usage on the board for ${label} yet — be the first.`,
    buildEyebrow: 'build your own',
    buildTitle: 'Your counter — one command.',
    buildPara:
      'Run the command in your terminal — it reads your local Codex and Claude Code logs, computes the API-equivalent, and puts you on this board. Only aggregates leave your machine.',
    attribution: 'Prices: LiteLLM · Counting: ccusage',
  }

  function pillClass(active: boolean): string {
    return active
      ? 'inline-flex h-8 items-center rounded-full bg-[#FF7A1A] px-3 font-mono text-[12px] font-bold text-black outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]'
      : 'inline-flex h-8 items-center rounded-full border border-white/20 px-3 font-mono text-[12px] font-bold text-[#D2D2D7] outline-none transition-colors hover:border-white/50 hover:text-white focus-visible:border-white/50 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]'
  }

  return (
    <div className="bg-[#F5F5F7] text-[#1D1D1F] [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-6 md:py-10">
          <div className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
            <Trophy className="h-4 w-4" /> {t.eyebrow}
          </div>
          <h1 className="mt-5 max-w-4xl text-balance text-[40px] font-black leading-[0.95] text-white sm:text-[56px] lg:text-[68px]">
            {t.title}
          </h1>
          <p className="mt-6 max-w-3xl text-[16px] leading-7 text-[#D2D2D7] md:text-[19px]">{t.sub}</p>

          {/* Period + agent filters stay as links so the page remains a
              force-dynamic server component with shareable URL state. */}
          <div className="mt-7 space-y-3">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="leaderboard-month-label"
            >
              <span
                id="leaderboard-month-label"
                className="mr-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#9A9AA0]"
              >
                month
              </span>
              {months.map((m) => (
                <Link
                  key={m.value}
                  href={leaderboardHref(m.value, agent)}
                  className={pillClass(period === m.value)}
                  aria-current={period === m.value ? 'true' : undefined}
                >
                  {m.label}
                </Link>
              ))}
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="leaderboard-year-label"
            >
              <span
                id="leaderboard-year-label"
                className="mr-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#9A9AA0]"
              >
                year
              </span>
              {years.map((y) => (
                <Link
                  key={y.value}
                  href={leaderboardHref(y.value, agent)}
                  className={pillClass(period === y.value)}
                  aria-current={period === y.value ? 'true' : undefined}
                >
                  {y.label}
                </Link>
              ))}
              <Link
                href={leaderboardHref('all', agent)}
                className={pillClass(period === 'all')}
                aria-current={period === 'all' ? 'true' : undefined}
              >
                All-time
              </Link>
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-labelledby="leaderboard-agent-label"
            >
              <span
                id="leaderboard-agent-label"
                className="mr-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#9A9AA0]"
              >
                AI agent
              </span>
              {AGENT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={leaderboardHref(period, option.value)}
                  className={pillClass(agent === option.value)}
                  aria-current={agent === option.value ? 'true' : undefined}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 font-mono text-[13px] font-bold">
              {SELF_SERVE_ONELINER}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7]">
        <div className="mx-auto max-w-[1680px] px-4 py-6 md:px-6">
          {rows.length === 0 ? (
            <p className="py-16 text-center text-[16px] font-semibold text-[#6E6E73]">{t.empty}</p>
          ) : (
            <TerminalCard
              title={`tokmax — ${agent === 'all' ? '' : `${selectedAgentLabel.toLowerCase()} — `}leaderboard — ${label.toLowerCase()}`}
              live
              tone="paper"
            >
              <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead className="bg-[#F5F5F7] text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
                  <tr>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">{t.rank}</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3">{t.nick}</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">{t.api}</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">{t.tokens}</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3">{t.machines}</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-semibold">
                  {rows.map((row, i) => (
                    <tr key={row.nick} className="border-b border-[#D2D2D7] hover:bg-[#F5F8FC]">
                      <td className="px-4 py-4 text-right font-black tabular-nums">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-4 py-4 font-black">
                        <div className="flex items-center gap-2">
                          {row.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.avatar_url.replace('_normal', '_400x400')}
                              alt={row.nick}
                              width={26}
                              height={26}
                              className="h-[26px] w-[26px] shrink-0 rounded-full border border-[#D2D2D7] object-cover"
                            />
                          ) : null}
                          <Link href={`/${row.nick}`} className="inline-flex items-center gap-1 hover:text-[#FF7A1A]">
                            {row.nick}
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
                          </Link>
                          {!row.verified ? (
                            <span className="ml-1 rounded bg-[#ECECEF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A9AA0]">
                              unverified
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-[#FF7A1A]" title={formatUsdPrecise(row.costUsd)}>
                        {formatUsd(row.costUsd)}
                      </td>
                      <td className="px-4 py-4 text-right text-[#6E6E73]">{formatCompactNumber(row.totalTokens)}</td>
                      <td className="px-4 py-4 text-[12px] font-semibold text-[#6E6E73]">
                        {/* Count only — labels are user-supplied and used to
                            leak raw hostnames; the number is the story. */}
                        <span className="inline-flex items-center rounded bg-[#ECECEF] px-2 py-0.5 font-mono text-[11px] font-bold">
                          💻 ×{row.machineLabels.length || 1}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </TerminalCard>
          )}
        </div>
      </section>

      <section id="build-your-counter" className="border-t border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] md:px-6 md:py-10">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              {t.buildEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-black leading-[1.0] md:text-[44px]">
              {t.buildTitle}
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-7 text-[#D2D2D7]">{t.buildPara}</p>
            <p className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#6E6E73]">
              <Flame className="h-3.5 w-3.5 text-[#FF7A1A]" /> {t.attribution}
            </p>
          </div>
          <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
        </div>
      </section>
    </div>
  )
}
