import { TerminalCard, TerminalPrompt } from '@/components/terminal-card'
import { fable5ChipLabel } from '@/lib/fable5'
import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import { loadTmxLeaderboard } from '@/lib/tmx-profile-live'
import { PromptCopyBox } from './prompt-copy-box'
import { ArrowUpRight, Flame, Sparkles, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELF_SERVE_ONELINER = 'npx tokmax'

export const metadata: Metadata = {
  title: 'tokmax — your public API-equivalent token-burn meter',
  description:
    'tokmax reads your local Codex and Claude Code logs, calculates what that usage would cost at API prices, and publishes the meter with one command.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'tokmax — how much you burned at API prices',
    description:
      'A public API-equivalent burn meter for Codex and Claude Code. Build yours with one command.',
    url: 'https://tokmax.vibecoding.tech/',
    type: 'website',
  },
}

export default async function LandingPage() {
  const rows = await loadTmxLeaderboard(100)
  const boardTotal = rows.reduce((sum, row) => sum + row.costUsd, 0)

  return (
    <div className="min-h-screen bg-[#070707] text-white [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:gap-14">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>TOKMAX</Badge>
              <Badge>API-EQUIVALENT</Badge>
            </div>

            <h1 className="mt-8 max-w-3xl text-balance text-[44px] font-black leading-[0.95] tracking-normal sm:text-[60px] lg:text-[72px]">
              How much you burned
              <br />
              <span className="text-[#FF7A1A]">at API prices.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-[17px] leading-7 text-[#D2D2D7] md:text-[20px] md:leading-8">
              tokmax is a public meter: it reads your local Codex and Claude Code logs and
              calculates what the same volume of tokens would cost if you paid API prices instead of
              a subscription. Only aggregates leave your machine — your keys and raw logs stay local.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-[14px] font-bold">
              <Link
                href="/leaderboard/fable-5"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#FF7A1A] bg-[#FF7A1A]/12 px-4 font-mono text-[13px] font-black uppercase tracking-[0.06em] text-[#FFC79A] transition-colors hover:bg-[#FF7A1A]/20"
              >
                <Sparkles className="h-4 w-4" />
                {fable5ChipLabel()}
              </Link>
              <Link
                href="#leaderboard"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[#070707] transition-colors hover:bg-[#E8E8ED]"
              >
                <Trophy className="h-4 w-4" />
                Leaderboard
              </Link>
              <Link
                href="https://x.com/eugeneshilow"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-white transition-colors hover:bg-white/10"
                target="_blank"
                rel="noopener noreferrer"
              >
                @eugeneshilow
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {boardTotal > 0 ? (
              <p className="mt-6 font-mono text-[13px] font-bold text-[#A1A1A6]">
                <span className="text-[#FF7A1A]">{formatUsd(boardTotal)}</span> burned on the board
                · {rows.length} dev{rows.length === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>

          <div className="self-start">
            <TerminalCard title={`tokmax — get yours — 80×24`} glow>
              <div className="flex flex-col gap-5 p-5">
                <TerminalPrompt size="lg" />
                <p className="max-w-md text-[14px] font-semibold leading-6 text-[#A1A1A6]">
                  Reads your local Codex + Claude Code logs, computes the API-equivalent{' '}
                  <span className="text-[#FF7A1A]">$</span> locally, and publishes your page at{' '}
                  <span className="text-white">tokmax.dev/&lt;nick&gt;</span>. Only
                  aggregate numbers leave your machine.
                </p>
                <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
              </div>
            </TerminalCard>
          </div>
        </div>
      </section>

      <section id="leaderboard" className="bg-[#0B0B0C]">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-6 md:py-16">
          <div className="flex flex-col gap-2 border-b border-[#242428] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#FF7A1A]">
                leaderboard
              </p>
              <h2 className="mt-1 text-[28px] font-black leading-none md:text-[34px]">
                Who burned the most
              </h2>
            </div>
            <p className="font-mono text-[12px] font-bold text-[#6E6E73]">
              API-equivalent · Codex + Claude Code
            </p>
            <Link
              href="/leaderboard/fable-5"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#FF7A1A]/60 px-3 text-[13px] font-bold text-[#FF7A1A] transition-colors hover:bg-[#FF7A1A]/10"
            >
              <Sparkles className="h-4 w-4" />
              Fable 5 board
            </Link>
          </div>

          {rows.length === 0 ? (
            <p className="mt-8 text-[15px] font-semibold text-[#A1A1A6]">
              Nothing here yet. Run{' '}
              <span className="font-mono text-[#FF7A1A]">{SELF_SERVE_ONELINER}</span> and be the
              first.
            </p>
          ) : (
            <TerminalCard title="tokmax — leaderboard" live className="mt-6">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="bg-[#111111] text-[11px] font-black uppercase tracking-[0.08em] text-[#A1A1A6]">
                  <tr>
                    <th className="border-b border-[#242428] px-4 py-3">#</th>
                    <th className="border-b border-[#242428] px-4 py-3">Nick</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">API-equivalent</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">Tokens</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">Last day</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-semibold">
                  {rows.map((row, index) => (
                    <tr key={row.nick} className="border-b border-[#1A1A1B] hover:bg-white/[0.03]">
                      <td className="px-4 py-4 font-black text-[#6E6E73]">
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/${row.nick}`}
                          className="inline-flex items-center gap-1.5 font-black text-white transition-colors hover:text-[#FF7A1A]"
                        >
                          {row.nick}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                      <td
                        className="px-4 py-4 text-right font-black text-[#FF7A1A]"
                        title={formatUsdPrecise(row.costUsd)}
                      >
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Flame className="h-3.5 w-3.5" />
                          {formatUsd(row.costUsd)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-4 text-right text-[#D2D2D7]"
                        title={formatInteger(row.totalTokens)}
                      >
                        {formatCompactNumber(row.totalTokens)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#A1A1A6]">
                        {row.lastDay}
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
