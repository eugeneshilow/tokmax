import { formatCompactNumber, formatInteger, formatUsd, formatUsdPrecise } from '@/lib/format'
import {
  loadTmxProfile,
  type TmxProfileDaily,
  type TmxProfileSource,
} from '@/lib/tmx-profile-live'
import { PromptCopyBox } from '../prompt-copy-box'
import { ArrowUpRight, Flame, Gauge, ReceiptText, ShieldAlert, Terminal, Zap } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TmxNickPageProps = {
  params: Promise<{ nick: string }>
}

const SELF_SERVE_ONELINER = 'npx tokmax'

export async function generateMetadata({ params }: TmxNickPageProps): Promise<Metadata> {
  const { nick: rawNick } = await params
  const nick = rawNick.toLowerCase()

  // Locale-aware метаданные: русскоязычный браузер → RU, иначе EN (детект по
  // Accept-Language, НЕ по гео).
  const acceptLang = (await headers()).get('accept-language')?.toLowerCase() ?? ''
  const isRu = acceptLang.startsWith('ru')

  const profile = await loadTmxProfile(nick)

  if (!profile) {
    return {
      title: isRu ? 'Профиль не найден — tokmax' : 'Profile not found — tokmax',
    }
  }

  const title = isRu
    ? `${profile.nick} нажёг ${formatUsd(profile.costUsd)} по API-расценкам — tokmax`
    : `${profile.nick} burned ${formatUsd(profile.costUsd)} at API prices — tokmax`
  const description = isRu
    ? `${profile.nick} сжёг ${formatCompactNumber(profile.totalTokens)} токенов Codex + Claude Code — ${formatUsdPrecise(profile.costUsd)} по цене API. Период с ${profile.firstDay} по ${profile.lastDay}.`
    : `${profile.nick} burned ${formatCompactNumber(profile.totalTokens)} tokens across Codex + Claude Code — ${formatUsdPrecise(profile.costUsd)} at API prices. ${profile.firstDay} to ${profile.lastDay}.`
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

export default async function TmxNickPage({ params }: TmxNickPageProps) {
  const { nick: rawNick } = await params
  const nick = rawNick.toLowerCase()
  const profile = await loadTmxProfile(nick)

  if (!profile) notFound()

  // Locale-aware фаннел: русскоязычный браузер → CTA на vibecoding.ru (детект по
  // Accept-Language, НЕ по гео — VPN не ломает: язык браузера не меняется).
  const acceptLang = (await headers()).get('accept-language')?.toLowerCase() ?? ''
  const isRu = acceptLang.startsWith('ru')

  const shareUrl = `tokmax.vibecoding.tech/${profile.nick}`
  const peakDay =
    profile.daily.length > 0
      ? profile.daily.reduce((max, day) => (day.totalTokens > max.totalTokens ? day : max))
      : null
  const maxDailyTokens = peakDay ? peakDay.totalTokens : 0

  // Экономика подписки: API-equivalent ÷ (подписка/мес × месяцы периода).
  const econ =
    profile.subscriptionUsd && profile.subscriptionUsd > 0
      ? (() => {
          const days = Math.max(
            1,
            Math.round((Date.parse(profile.lastDay) - Date.parse(profile.firstDay)) / 86400000) + 1
          )
          const months = Math.max(1, days / 30)
          const subTotal = profile.subscriptionUsd * months
          const ratio = subTotal > 0 ? profile.costUsd / subTotal : 0
          const profit = profile.costUsd - subTotal
          return { months, subTotal, ratio, profit, sub: profile.subscriptionUsd }
        })()
      : null

  const machines = profile.machineLabels.join(' + ') || '—'

  // Bilingual copy: RU для русскоязычных браузеров, EN по умолчанию.
  const t = isRu
    ? {
        heroVerb: 'нажёг',
        heroApiSuffix: 'по API.',
        heroPara: `Это ${formatInteger(profile.totalTokens)} токенов Codex и Claude Code за период с ${profile.firstDay} по ${profile.lastDay}. Столько этот объём стоил бы, если платить за usage по цене API, а не по подписке.`,
        notVerified: 'число не верифицировано',
        econLabel: 'api ÷ подписка',
        econSentence: econ
          ? `Подписка ${formatUsdPrecise(econ.sub)}/мес — за период это ≈ ${formatUsdPrecise(econ.subTotal)}. API-equivalent ${formatUsdPrecise(profile.costUsd)} → отбил подписку в ${econ.ratio.toFixed(1)}×${econ.profit >= 0 ? `, сэкономил +${formatUsdPrecise(econ.profit)}` : ''}.`
          : '',
        buildYourOwnCta: 'Собрать свой',
        asideApiEquivalent: 'api-equivalent',
        asideApiPrice: `${formatUsdPrecise(profile.costUsd)} по цене API`,
        asideTokensTotal: 'токенов всего',
        asideTokensCount: `${formatInteger(profile.totalTokens)} токенов`,
        rowPeriod: 'период',
        rowDays: 'дней',
        rowCli: 'cli',
        machinesNote: `Машины: ${machines}. Собрано локально, наружу уходят только агрегаты.`,
        dailyBurnTitle: 'Дневной расход токенов',
        scoreboardTitle: 'Итого по источникам',
        buildEyebrow: 'собери свой',
        counterTitleLine1: 'Свой счётчик —',
        counterTitleLine2: 'одной командой.',
        counterPara:
          'Запусти одну команду в терминале — она прочитает локальные логи Codex и Claude Code, посчитает API-equivalent и опубликует твою страницу. Наружу уходят только агрегаты: ни ключей, ни сырых логов.',
        howComputed: 'Как это считается',
        footerEyebrow: `${profile.nick} · с ${profile.firstDay} по ${profile.lastDay}`,
        footerTitle: `${formatUsd(profile.costUsd)} по API. Скриншоть и кидай в чат.`,
        statApiEquivalentDetail: 'столько этот объём стоил бы по цене API, а не по подписке',
        statTotalTokensLabel: 'Итого токенов',
        statTotalTokensDetail: `${formatInteger(profile.totalTokens)} токенов Codex + Claude Code`,
        statPeriodLabel: 'Период',
        statPeriodDetail: `с ${profile.firstDay} по ${profile.lastDay} · ${profile.daily.length} дней`,
        statPeakLabel: 'Пик дня',
        statPeakDetail: peakDay ? `${peakDay.date}: самый горячий день` : 'нет дневных данных',
      }
    : {
        heroVerb: 'burned',
        heroApiSuffix: 'at API prices.',
        heroPara: `That's ${formatInteger(profile.totalTokens)} tokens across Codex and Claude Code, from ${profile.firstDay} to ${profile.lastDay}. That's what this usage would cost if you paid for it at API prices instead of on a subscription.`,
        notVerified: 'figure not verified',
        econLabel: 'api ÷ subscription',
        econSentence: econ
          ? `Subscription ${formatUsdPrecise(econ.sub)}/mo — over this period that's ≈ ${formatUsdPrecise(econ.subTotal)}. API-equivalent ${formatUsdPrecise(profile.costUsd)} → paid the subscription back ${econ.ratio.toFixed(1)}×${econ.profit >= 0 ? `, saved +${formatUsdPrecise(econ.profit)}` : ''}.`
          : '',
        buildYourOwnCta: 'Build your own',
        asideApiEquivalent: 'api-equivalent',
        asideApiPrice: `${formatUsdPrecise(profile.costUsd)} at API prices`,
        asideTokensTotal: 'total tokens',
        asideTokensCount: `${formatInteger(profile.totalTokens)} tokens`,
        rowPeriod: 'period',
        rowDays: 'days',
        rowCli: 'cli',
        machinesNote: `Machines: ${machines}. Computed locally; only aggregates leave the box.`,
        dailyBurnTitle: 'Daily token burn',
        scoreboardTitle: 'Totals by source',
        buildEyebrow: 'build your own',
        counterTitleLine1: 'Your own counter —',
        counterTitleLine2: 'one command.',
        counterPara:
          'Run one command in your terminal — it reads your local Codex and Claude Code logs, computes the API-equivalent, and publishes your page. Only aggregates leave the box: no keys, no raw logs.',
        howComputed: "How it's computed",
        footerEyebrow: `${profile.nick} · ${profile.firstDay} to ${profile.lastDay}`,
        footerTitle: `${formatUsd(profile.costUsd)} at API prices. Screenshot it and drop it in chat.`,
        statApiEquivalentDetail: 'what this usage would cost at API prices, not on a subscription',
        statTotalTokensLabel: 'Total tokens',
        statTotalTokensDetail: `${formatInteger(profile.totalTokens)} tokens across Codex + Claude Code`,
        statPeriodLabel: 'Period',
        statPeriodDetail: `${profile.firstDay} to ${profile.lastDay} · ${profile.daily.length} days`,
        statPeakLabel: 'Peak day',
        statPeakDetail: peakDay ? `${peakDay.date}: hottest day` : 'no daily data',
      }

  const statCards = [
    {
      label: 'API-equivalent',
      value: formatUsdPrecise(profile.costUsd),
      detail: t.statApiEquivalentDetail,
      icon: Flame,
    },
    {
      label: t.statTotalTokensLabel,
      value: formatCompactNumber(profile.totalTokens),
      detail: t.statTotalTokensDetail,
      icon: Gauge,
    },
    {
      label: t.statPeriodLabel,
      value: `${profile.firstDay}`,
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

  return (
    <div className="bg-[#F5F5F7] text-[#1D1D1F] [font-variant-numeric:tabular-nums]">
      <section className="border-b border-[#242428] bg-[#070707] text-white">
        <div className="mx-auto grid max-w-[1680px] gap-8 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>TOKENMAX</Badge>
              <Badge>API-EQUIVALENT</Badge>
              {profile.machineLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>

            <h1 className="mt-8 max-w-5xl text-balance text-[44px] font-black leading-[0.95] tracking-normal text-white sm:text-[64px] lg:text-[80px]">
              {profile.nick} {t.heroVerb}
              <br />
              <span className="text-[#FF7A1A]">{formatUsd(profile.costUsd)}</span> {t.heroApiSuffix}
            </h1>

            <p className="mt-7 max-w-3xl text-[17px] leading-7 text-[#D2D2D7] md:text-[20px] md:leading-8">
              {t.heroPara}
            </p>

            {profile.suspicious ? (
              <p className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#A1A1A6]">
                <ShieldAlert className="h-4 w-4" />
                {t.notVerified}
              </p>
            ) : null}

            {econ ? (
              <div className="mt-7 inline-flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-[#18D86B]/40 bg-[#18D86B]/10 px-5 py-4">
                <div>
                  <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#9EFFBF]">
                    {t.econLabel}
                  </p>
                  <p className="text-[44px] font-black leading-none text-[#18D86B]">
                    {econ.ratio.toFixed(1)}×
                  </p>
                </div>
                <p className="max-w-md text-[14px] font-semibold leading-6 text-[#B9FFD5]">
                  {t.econSentence}
                </p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3 text-[14px] font-bold">
              {isRu ? (
                <Link
                  href="https://vibecoding.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF7A1A] px-4 font-black text-[#070707] transition-colors hover:bg-[#ff8c3a]"
                >
                  Научись так же → vibecoding.ru
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
              <Link
                href="https://t.me/shilovtech"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[#070707] transition-colors hover:bg-[#E8E8ED]"
                target="_blank"
                rel="noopener noreferrer"
              >
                @shilovtech
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <div className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-white">
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

          <aside className="self-end border border-white/14 bg-white/[0.06] p-4">
            <div className="border-b border-white/14 pb-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[12px] font-black uppercase tracking-[0.08em] text-[#A1A1A6]">
                  {t.asideApiEquivalent}
                </p>
                <Flame className="h-5 w-5 text-[#FF7A1A]" />
              </div>
              <p className="mt-3 text-[54px] font-black leading-[0.85] text-[#FF7A1A] md:text-[64px]">
                {formatUsd(profile.costUsd)}
              </p>
              <p className="mt-3 text-[13px] font-semibold text-[#A1A1A6]">
                {t.asideApiPrice}
              </p>
            </div>

            <div className="mt-4 border border-[#3861FB]/40 bg-[#0A1733] p-4 text-[#DCE7FF]">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#9DBBFF]">
                  {t.asideTokensTotal}
                </p>
                <Gauge className="h-5 w-5 text-[#3861FB]" />
              </div>
              <p className="mt-3 text-[34px] font-black leading-none text-[#7DA2FF] md:text-[42px]">
                {formatCompactNumber(profile.totalTokens)}
              </p>
              <p className="mt-3 text-[13px] font-bold text-[#9DBBFF]">
                {t.asideTokensCount}
              </p>
            </div>

            <div className="mt-5 grid gap-1 font-mono text-[12px] font-bold uppercase tracking-normal text-[#A1A1A6]">
              <div className="flex items-center justify-between gap-4">
                <span>{t.rowPeriod}</span>
                <span className="text-[#D2D2D7]">
                  {profile.firstDay} — {profile.lastDay}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t.rowDays}</span>
                <span className="text-[#D2D2D7]">{profile.daily.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t.rowCli}</span>
                <span className="text-[#D2D2D7]">{profile.cliVersion}</span>
              </div>
            </div>

            <p className="mt-4 text-[12px] font-semibold leading-5 text-[#A1A1A6]">
              {t.machinesNote}
            </p>
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

      {profile.daily.length > 0 ? (
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
              {profile.daily.map((day) => (
                <DailyBar key={day.date} day={day} max={maxDailyTokens} />
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
            right={`${profile.machineLabels.join(' + ') || 'aggregate'} · API estimate`}
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
                {isRu ? (
                  <Link
                    href="https://vibecoding.ru"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF7A1A] px-4 font-black text-[#070707] transition-colors hover:bg-[#ff8c3a]"
                  >
                    Научись вайбкодить → vibecoding.ru
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link
                  href="https://t.me/shilovtech"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[#070707] transition-colors hover:bg-[#E8E8ED]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @shilovtech
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-white transition-colors hover:bg-white/10"
                >
                  <Terminal className="h-4 w-4" />
                  {t.howComputed}
                </Link>
              </div>
            </div>

            <PromptCopyBox prompt={SELF_SERVE_ONELINER} />
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
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-black">
            <span className="rounded-lg bg-[#1A1206] px-3 py-2 text-[#FF7A1A]">
              {formatUsdPrecise(profile.costUsd)}
            </span>
            <span className="rounded-lg border border-[#D2D2D7] px-3 py-2">{shareUrl}</span>
            <span className="rounded-lg bg-[#1D1D1F] px-3 py-2 text-white">tokenmax</span>
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
  const width = max > 0 ? Math.max(1, Math.round((day.totalTokens / max) * 100)) : 1
  const codexWidth = day.totalTokens > 0 ? Math.round((day.codexTokens / day.totalTokens) * 100) : 0

  return (
    <div className="grid gap-2 border border-[#D2D2D7] bg-white p-3 md:grid-cols-[116px_1fr_120px] md:items-center">
      <p className="font-mono text-[13px] font-black">{day.date}</p>
      <div className="h-8 bg-[#F5F5F7]">
        <div className="flex h-8" style={{ width: `${width}%` }}>
          <div className="h-8 bg-[#3861FB]" style={{ width: `${codexWidth}%` }} />
          <div className="h-8 flex-1 bg-[#FF7A1A]" />
        </div>
      </div>
      <div className="text-[13px] font-black md:text-right">
        {formatCompactNumber(day.totalTokens)}
      </div>
    </div>
  )
}
