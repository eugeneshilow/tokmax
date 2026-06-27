import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import { loadTmxLeaderboard } from '@/lib/tmx-profile-live'
import { PromptCopyBox } from './prompt-copy-box'
import { ArrowUpRight, Flame, Terminal, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SELF_SERVE_ONELINER = 'npx tokmax'

export const metadata: Metadata = {
  title: 'tokenmax — публичный счётчик API-equivalent расхода токенов',
  description:
    'tokenmax читает локальные логи Codex и Claude Code, считает, во сколько обошёлся бы твой usage по цене API, и публикует счётчик одной командой.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'tokenmax — сколько ты нажёг по API-расценкам',
    description:
      'Публичный счётчик API-equivalent расхода Codex и Claude Code. Собери свой одной командой.',
    url: 'https://tokenmax.vibecoding.ru/',
    type: 'website',
  },
}

export default async function LandingPage() {
  const rows = await loadTmxLeaderboard(100)

  return (
    <div className="min-h-screen bg-[#070707] text-white [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:gap-14">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>TOKENMAX</Badge>
              <Badge>API-EQUIVALENT</Badge>
            </div>

            <h1 className="mt-8 max-w-3xl text-balance text-[44px] font-black leading-[0.95] tracking-normal sm:text-[60px] lg:text-[72px]">
              Сколько ты нажёг
              <br />
              <span className="text-[#FF7A1A]">по цене API.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-[17px] leading-7 text-[#D2D2D7] md:text-[20px] md:leading-8">
              tokenmax — публичный счётчик: он читает локальные логи Codex и Claude Code и считает,
              во сколько обошёлся бы тот же объём токенов, если платить за usage по цене API, а не по
              подписке. Наружу уходят только агрегаты: ни ключей, ни сырых логов.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-[14px] font-bold">
              <Link
                href="#leaderboard"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[#070707] transition-colors hover:bg-[#E8E8ED]"
              >
                <Trophy className="h-4 w-4" />
                Лидерборд
              </Link>
              <Link
                href="https://t.me/shilovtech"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-white transition-colors hover:bg-white/10"
                target="_blank"
                rel="noopener noreferrer"
              >
                @shilovtech
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-6 inline-flex items-center gap-2 font-mono text-[13px] font-bold text-[#18D86B]">
              <Terminal className="h-4 w-4" />
              {SELF_SERVE_ONELINER}
            </p>
          </div>

          <div className="self-start">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#18D86B]">
              собери свой
            </p>
            <h2 className="mt-3 text-[28px] font-black leading-[1.0]">
              Свой счётчик — одной командой.
            </h2>
            <p className="mt-4 max-w-md text-[15px] font-semibold leading-7 text-[#D2D2D7]">
              Запусти команду в терминале — она посчитает API-equivalent и опубликует твою страницу
              на <span className="text-white">tokmax.ru/&lt;ник&gt;</span>.
            </p>
            <div className="mt-6">
              <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
            </div>
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
                Кто сжёг больше всех
              </h2>
            </div>
            <p className="font-mono text-[12px] font-bold text-[#6E6E73]">
              API-equivalent · Codex + Claude Code
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="mt-8 text-[15px] font-semibold text-[#A1A1A6]">
              Пока пусто. Запусти{' '}
              <span className="font-mono text-[#18D86B]">{SELF_SERVE_ONELINER}</span> и стань первым.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto border border-[#242428]">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="bg-[#111111] text-[11px] font-black uppercase tracking-[0.08em] text-[#A1A1A6]">
                  <tr>
                    <th className="border-b border-[#242428] px-4 py-3">#</th>
                    <th className="border-b border-[#242428] px-4 py-3">Ник</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">API-equivalent</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">Токенов</th>
                    <th className="border-b border-[#242428] px-4 py-3 text-right">Последний день</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-semibold">
                  {rows.map((row, index) => (
                    <tr key={row.nick} className="border-b border-[#1A1A1B] hover:bg-white/[0.03]">
                      <td className="px-4 py-4 font-black text-[#6E6E73]">{index + 1}</td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/${row.nick}`}
                          className="inline-flex items-center gap-1.5 font-black text-white transition-colors hover:text-[#FF7A1A]"
                        >
                          {row.nick}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-[#FF7A1A]">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Flame className="h-3.5 w-3.5" />
                          {formatUsd(row.costUsd)}
                        </span>
                        <span className="ml-2 text-[12px] font-semibold text-[#6E6E73]">
                          {formatUsdPrecise(row.costUsd)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-[#D2D2D7]">
                        {formatCompactNumber(row.totalTokens)}
                        <span className="ml-2 text-[12px] text-[#6E6E73]">
                          {formatInteger(row.totalTokens)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#A1A1A6]">
                        {row.lastDay}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
