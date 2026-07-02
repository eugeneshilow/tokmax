import { TerminalCard } from '@/components/terminal-card'
import { fable5Countdown } from '@/lib/fable5'
import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import { FABLE5_LEADERBOARD_LABEL, loadTmxFable5Leaderboard } from '@/lib/tmx-profile-live'
import { PromptCopyBox } from '../../prompt-copy-box'
import { ArrowUpRight, Flame, Sparkles, Terminal, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELF_SERVE_ONELINER = 'npx tokmax'
const MEDALS = ['🥇', '🥈', '🥉']

export const metadata: Metadata = {
  title: 'Fable 5 leaderboard — tokmax',
  description: 'Fable 5 API-equivalent spend leaderboard for July 1-7, 2026.',
  alternates: { canonical: '/leaderboard/fable-5' },
  openGraph: {
    title: 'Fable 5 leaderboard — tokmax',
    description: 'Ranked by Fable 5 API-equivalent spend from July 1-7, 2026.',
    url: 'https://tokmax.vibecoding.tech/leaderboard/fable-5',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Fable 5 leaderboard — tokmax' },
}

export default async function Fable5LeaderboardPage() {
  const rows = await loadTmxFable5Leaderboard(100)
  const totalSpend = rows.reduce((sum, row) => sum + row.fable5CostUsd, 0)
  const totalTokens = rows.reduce((sum, row) => sum + row.fable5Tokens, 0)
  const countdown = fable5Countdown()

  return (
    <div className="min-h-screen bg-[#070707] text-white [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428]">
        <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-6 md:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              <Sparkles className="h-4 w-4" /> Fable 5 special
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
            Fable 5 spend leaderboard.
          </h1>
          <p className="mt-6 max-w-3xl text-[16px] leading-7 text-[#D2D2D7] md:text-[19px]">
            Ranked only by API-equivalent spend attributed to Fable 5 from {FABLE5_LEADERBOARD_LABEL}.
            Usage before July 1, 2026 is ignored.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
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
              title={`tokmax — leaderboard/fable-5 — ${FABLE5_LEADERBOARD_LABEL} · ${formatUsdPrecise(totalSpend)} · ${formatCompactNumber(totalTokens)} tokens`}
              live
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

      <section className="border-t border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] md:px-6 md:py-10">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
              join the board
            </p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-black leading-[1.0] md:text-[44px]">
              Publish your current burn.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-7 text-[#D2D2D7]">
              New tokmax publishes include per-day model spend, so only Fable 5 usage from July 1-7,
              2026 lands here. Earlier usage is ignored for this special board.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#6E6E73]">
              <Terminal className="h-3.5 w-3.5 text-[#FF7A1A]" /> Prices: LiteLLM · Counting: ccusage
            </p>
          </div>
          <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
        </div>
      </section>
    </div>
  )
}
