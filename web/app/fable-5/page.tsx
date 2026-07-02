import { TerminalCard } from '@/components/terminal-card'
import { MARGINAL_MAX_USD_PER_MO, fable5Countdown, fable5StackMath } from '@/lib/fable5'
import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import { FABLE5_LEADERBOARD_LABEL, loadTmxFable5Leaderboard } from '@/lib/tmx-profile-live'
import { PromptCopyBox } from '../prompt-copy-box'
import { ArrowUpRight, Flame, Scale, Sparkles, Terminal, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELF_SERVE_ONELINER = 'npx tokmax'
const MEDALS = ['🥇', '🥈', '🥉']

export const metadata: Metadata = {
  title: 'Fable 5 Week — a tokmax launch-week board',
  description:
    'Who burns the most on Fable 5, July 1-7 (San Francisco time) — and is one Max even enough? The board doubles as second-subscription math.',
  alternates: { canonical: '/fable-5' },
  openGraph: {
    title: 'Fable 5 Week — a tokmax launch-week board',
    description:
      'Ranked by Fable 5 API-equivalent spend, July 1-7, 2026. The board doubles as second-subscription math.',
    url: 'https://tokmax.vibecoding.tech/fable-5',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Fable 5 Week — a tokmax launch-week board' },
}

export default async function Fable5WeekPage() {
  const rows = await loadTmxFable5Leaderboard(100)
  const totalSpend = rows.reduce((sum, row) => sum + row.fable5CostUsd, 0)
  const totalTokens = rows.reduce((sum, row) => sum + row.fable5Tokens, 0)
  const countdown = fable5Countdown()
  const communityMath = fable5StackMath(rows.length > 0 ? totalSpend / rows.length : 0)
  const topMath = rows.length > 0 ? fable5StackMath(rows[0].fable5CostUsd) : null

  return (
    <div className="min-h-screen bg-[#070707] text-white [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428]">
        <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-6 md:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              <Sparkles className="h-4 w-4" /> Fable 5 Week · a tokmax launch-week board
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#FF7A1A]/60 bg-[#FF7A1A]/10 px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FFC79A]">
              {countdown.over
                ? 'final results · July 1-7, 2026'
                : `day ${countdown.day}/7 · ends Jul 7 · ${countdown.daysLeft} day${countdown.daysLeft === 1 ? '' : 's'} left`}
            </span>
            <span className="font-mono text-[11px] font-bold text-[#6E6E73]">
              San Francisco time
            </span>
          </div>
          <h1 className="mt-5 max-w-5xl text-balance text-[42px] font-black leading-[0.95] text-white sm:text-[60px] lg:text-[76px]">
            Who burns the most
            <br />
            <span className="text-[#A1A1A6]">on Fable 5?</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[16px] leading-7 text-[#D2D2D7] md:text-[19px]">
            Ranked only by API-equivalent spend attributed to Fable 5, {FABLE5_LEADERBOARD_LABEL}.
            Usage before July 1 is ignored. And since Anthropic capped Fable 5 at 50% of your
            weekly limit through July 7 — the board doubles as an answer to the real question:{' '}
            <span className="font-bold text-white">is one Max even enough?</span>
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#stack-math"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#FF7A1A] bg-[#FF7A1A]/12 px-4 text-[14px] font-bold text-[#FFC79A] transition-colors hover:bg-[#FF7A1A]/20"
            >
              <Scale className="h-4 w-4" />
              Stack math
            </a>
            <Link
              href="/leaderboard"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/10"
            >
              <Trophy className="h-4 w-4" />
              Main leaderboard
            </Link>
            <span className="inline-flex h-10 items-center rounded-lg border border-[#FF7A1A]/50 px-4 font-mono text-[13px] font-bold text-[#FF7A1A]">
              {SELF_SERVE_ONELINER}
            </span>
            <a
              href="https://github.com/eugeneshilow/tokmax"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 font-mono text-[13px] font-bold text-[#D2D2D7] transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowUpRight className="h-4 w-4" />
              github.com/eugeneshilow/tokmax
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7] text-[#1D1D1F]">
        <div className="mx-auto max-w-[1680px] px-4 py-6 md:px-6">
          {rows.length === 0 ? (
            <p className="py-16 text-center text-[16px] font-semibold text-[#6E6E73]">
              Waiting for the first Fable 5 publish in the July 1-7, 2026 window.
            </p>
          ) : (
            <TerminalCard
              title={`tokmax — /fable-5 — ${FABLE5_LEADERBOARD_LABEL} · ${formatUsdPrecise(totalSpend)} · ${formatCompactNumber(totalTokens)} tokens`}
              live={!countdown.over}
              tone="paper"
            >
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#F5F5F7] text-[11px] font-black uppercase tracking-[0.08em] text-[#6E6E73]">
                  <tr>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">#</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3">nick</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">Fable 5 spend</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">Fable 5 tokens</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">all spend</th>
                    <th className="border-b border-[#D2D2D7] px-4 py-3 text-right">last day</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-semibold">
                  {rows.map((row, i) => (
                    <tr key={row.nick} className="border-b border-[#D2D2D7] hover:bg-[#F5F8FC]">
                      <td className="px-4 py-4 text-right font-black tabular-nums">
                        {i < MEDALS.length ? (
                          <span className="text-[18px]" aria-label={`rank ${i + 1}`}>
                            {MEDALS[i]}
                          </span>
                        ) : (
                          i + 1
                        )}
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
                          {row.verified ? (
                            // Verified nick == the X handle: rank doubles as a
                            // follow-back link — the real prize for climbing.
                            <a
                              href={`https://x.com/${row.nick}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 rounded bg-[#1D1D1F] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#FF7A1A]"
                            >
                              follow
                            </a>
                          ) : (
                            <span className="ml-1 rounded bg-[#ECECEF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A9AA0]">
                              unverified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-[#FF7A1A]" title={formatUsdPrecise(row.costUsd)}>
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Flame className="h-3.5 w-3.5" />
                          {formatUsd(row.costUsd)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-4 text-right text-[#6E6E73]"
                        title={formatInteger(row.totalTokens)}
                      >
                        {formatCompactNumber(row.totalTokens)}
                      </td>
                      <td className="px-4 py-4 text-right text-[#6E6E73]">{formatUsd(row.allCostUsd)}</td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#6E6E73]">{row.lastDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </TerminalCard>
          )}
        </div>
      </section>

      {/* Stack Math — the event's second job: should you buy another sub? */}
      <section id="stack-math" className="border-t border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] md:px-6 md:py-12">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              <Scale className="h-4 w-4" /> stack math
            </p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-black leading-[1.0] md:text-[44px]">
              {countdown.over ? 'The week’s verdict: was one Max enough?' : 'Is one Max enough?'}
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-7 text-[#D2D2D7]">
              Fable 5 launched capped at 50% of your weekly limit through July 7. So the question
              this week isn’t just who burns the most — it’s whether a{' '}
              <span className="text-white">second subscription pays for itself</span>. Your board
              entry already contains the answer: take your window pace, extrapolate to a month,
              divide by the marginal ${MARGINAL_MAX_USD_PER_MO}/mo of one more Max.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-7 text-[#A1A1A6]">
              And remember the asymmetry: your logs only show what the cap{' '}
              <span className="text-white">let</span> you burn. If you’re hitting limits, the pace
              on the board <span className="text-white">understates</span> your real demand — the
              stack pays back more, not less. Same rule applies marginally: a third sub only pays
              if you’re still capped with two.
            </p>
            <p className="mt-4 font-mono text-[12px] font-bold text-[#6E6E73]">
              API-equivalent value, not cash — a decision aid, not financial advice.
            </p>
            {countdown.over ? (
              <p className="mt-5 max-w-2xl text-[15px] font-bold leading-7 text-[#FFC79A]">
                Every major model launch gets a launch-week board. Follow{' '}
                <a
                  href="https://x.com/eugeneshilow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-4 hover:text-[#FF7A1A]"
                >
                  @eugeneshilow
                </a>{' '}
                for the next one.
              </p>
            ) : null}
          </div>

          <TerminalCard title="tokmax — stack-math — bc mode" glow>
            <div className="p-5 font-mono text-[13px] leading-relaxed">
              <p>
                <span className="text-[#6E6E73]">$</span>{' '}
                <span className="font-bold text-white">stack-math --window fable-5</span>
              </p>
              <div className="mt-3 space-y-1 text-[#A1A1A6]">
                <p>
                  weekly pace <span className="text-[#6E6E73]">=</span> window burn ÷ days elapsed
                  × 7
                </p>
                <p>
                  2nd-sub payback <span className="text-[#6E6E73]">=</span> monthly pace ÷ $
                  {MARGINAL_MAX_USD_PER_MO}
                </p>
              </div>
              {communityMath ? (
                <div className="mt-4 space-y-1 border-t border-[#242428] pt-3">
                  <p className="text-[#D2D2D7]">
                    board average <span className="text-[#6E6E73]">·</span>{' '}
                    <span className="font-bold text-[#FF7A1A]">
                      {formatUsd(communityMath.weeklyRateUsd)}/wk
                    </span>{' '}
                    pace → 2nd Max pays back{' '}
                    <span className="font-bold text-[#18D86B]">
                      {communityMath.secondSubMultiple.toFixed(1)}×
                    </span>
                  </p>
                  {topMath && rows[0] ? (
                    <p className="text-[#D2D2D7]">
                      board #1 <span className="text-[#6E6E73]">·</span>{' '}
                      <span className="font-bold text-[#FF7A1A]">
                        {formatUsd(topMath.weeklyRateUsd)}/wk
                      </span>{' '}
                      pace → 2nd Max pays back{' '}
                      <span className="font-bold text-[#18D86B]">
                        {topMath.secondSubMultiple.toFixed(1)}×
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 border-t border-[#242428] pt-3 text-[#6E6E73]">
                  waiting for the first publish — the board computes the community pace live
                </p>
              )}
              <p className="mt-4 text-[12px] text-[#6E6E73]">
                your own line prints after <span className="text-[#FF7A1A]">npx tokmax</span> and
                lives on your profile receipt
              </p>
            </div>
          </TerminalCard>
        </div>
      </section>

      {/* How to enter — 30 seconds, three steps. */}
      <section className="border-t border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] md:px-6 md:py-10">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              how to enter · 30 seconds
            </p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-black leading-[1.0] md:text-[44px]">
              Publish your current burn.
            </h2>
            <ol className="mt-5 max-w-2xl space-y-2 text-[15px] font-semibold leading-7 text-[#D2D2D7]">
              <li>
                <span className="font-mono font-black text-[#FF7A1A]">1</span> · run{' '}
                <span className="font-mono text-white">npx tokmax</span> — it scans your local
                logs, nothing but aggregate numbers leaves your machine
              </li>
              <li>
                <span className="font-mono font-black text-[#FF7A1A]">2</span> · sign in with X —
                your rank links back to your profile (that’s the prize)
              </li>
              <li>
                <span className="font-mono font-black text-[#FF7A1A]">3</span> · publish — only
                your Fable 5 usage from {FABLE5_LEADERBOARD_LABEL} counts here
              </li>
            </ol>
            <p className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#6E6E73]">
              <Terminal className="h-3.5 w-3.5 text-[#FF7A1A]" /> Prices: LiteLLM · Counting:
              ccusage ·{' '}
              <a
                href="https://github.com/eugeneshilow/tokmax"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#D2D2D7] underline decoration-dotted underline-offset-4 hover:text-[#FF7A1A]"
              >
                open source
              </a>
            </p>
          </div>
          <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
        </div>
      </section>
    </div>
  )
}
