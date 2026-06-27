// tokenmax (L2) self-serve — чистые хелперы и валидаторы.
//
// Pure-модуль (логика без convex-рантайма) → юнит-тестируется без convexTest.
// Поля-валидаторы здесь же, чтобы schema.ts, table-модули и тесты тянули один
// источник формы. Крипто (хеши IP/секрета) живёт в http.ts (httpAction), сюда
// приходят уже готовые хеши — этот модуль детерминирован.

import { v } from 'convex/values'
import { TMX_FALLBACK_RATE, costUsdForUsage, resolveModelRate, type TmxTool } from './tmx_pricing'

// ---------------------------------------------------------------------------
// Поля-валидаторы (schema + table-модули импортируют отсюда)
// ---------------------------------------------------------------------------

/** Поток токенов одной модели (хранится в raw-публикации). */
export const tmxModelUsageFields = {
  model: v.string(),
  tool: v.string(),
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
}

/** Агрегат по инструменту (Codex / Claude Code) — серверный расчёт $. */
export const tmxSourceFields = {
  source: v.string(),
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
  totalTokens: v.number(),
  costUsd: v.number(),
}

/** Дневной столбик для графика (токены; $ по дням — V2). */
export const tmxDailyFields = {
  date: v.string(),
  codexTokens: v.number(),
  claudeTokens: v.number(),
  totalTokens: v.number(),
}

/** Суммарные токены + API-equivalent $. */
export const tmxTotalsFields = {
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
  totalTokens: v.number(),
  costUsd: v.number(),
}

// ---- входные валидаторы (что CLI шлёт, что http передаёт в мутацию) ----

export const vTmxModelUsageInput = v.object(tmxModelUsageFields)
export const vTmxDailyInput = v.object({
  date: v.string(),
  codexTokens: v.number(),
  claudeTokens: v.number(),
})

/** Аргументы internal-мутации publish (http уже посчитал хеши). */
export const vTmxPublishArgs = {
  nick: v.string(),
  cliVersion: v.string(),
  pricingVersion: v.string(),
  firstDay: v.string(),
  lastDay: v.string(),
  machineLabel: v.string(),
  models: v.array(vTmxModelUsageInput),
  daily: v.array(vTmxDailyInput),
  ipHash: v.string(),
  providedSecretHash: v.union(v.string(), v.null()),
  candidateSecretHash: v.string(),
  // Опциональная подписка $/мес (из онбординга) для economics-блока профиля.
  subscriptionUsd: v.optional(v.number()),
}

export const vTmxPublishResult = v.union(
  v.object({
    ok: v.literal(true),
    created: v.boolean(),
    nick: v.string(),
    suspicious: v.boolean(),
    costUsd: v.number(),
    totalTokens: v.number(),
  }),
  v.object({
    ok: v.literal(false),
    reason: v.union(
      v.literal('nick_invalid'),
      v.literal('nick_taken'),
      v.literal('rate_limited'),
      v.literal('empty_usage'),
      // HARDENING #6: hard value-cap → отказ (не только флаг suspicious).
      v.literal('value_too_high')
    ),
    message: v.optional(v.string()),
    suggestion: v.optional(v.string()),
  })
)

// ---------------------------------------------------------------------------
// Ник: формат + модерация (анти-сквоттинг бренда + блок-лист)
// ---------------------------------------------------------------------------

export const NICK_MIN = 2
export const NICK_MAX = 30

// Зарезервированные слова: системные/роутовые + бренд. Точное совпадение.
const RESERVED_NICKS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'root',
  'support',
  'help',
  'about',
  'login',
  'logout',
  'signin',
  'signup',
  'account',
  'settings',
  'me',
  'you',
  'new',
  'edit',
  'null',
  'undefined',
  'none',
  'test',
  'tests',
  'pricing',
  'publish',
  'leaderboard',
  'og',
  'opengraph-image',
  'favicon',
  'robots',
  'sitemap',
  'assets',
  'static',
  'public',
  'privacy',
  'legal',
  'terms',
  'convex',
  'next',
  'system',
  'official',
  'vibecoding',
  'tokenmax',
  'tokenmaxxing',
])

// Бренд-сквоттинг: подстрока (нельзя зарегать `my-vibecoding`).
const BRAND_SUBSTRINGS = ['vibecoding', 'tokenmaxxing', 'tokenmax']

// Скромный блок-лист оскорблений (подстрока, RU + EN корни).
const PROFANITY_SUBSTRINGS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'faggot',
  'хуй',
  'хуя',
  'пизд',
  'ебан',
  'еба',
  'бля',
  'сука',
  'мудак',
  'гондон',
  'долбоеб',
  'пидор',
  'пидар',
  'нахуй',
]

export function normalizeNick(raw: string): string {
  return raw.trim().toLowerCase()
}

export type NickValidation =
  | { ok: true; nick: string }
  | { ok: false; reason: 'nick_invalid'; message: string }

/** Формат + блок-лист. Возвращает нормализованный (lowercase) ник. */
export function validateNick(raw: string): NickValidation {
  const nick = normalizeNick(raw)

  if (nick.length < NICK_MIN || nick.length > NICK_MAX) {
    return {
      ok: false,
      reason: 'nick_invalid',
      message: `Ник должен быть от ${NICK_MIN} до ${NICK_MAX} символов.`,
    }
  }

  // a-z 0-9 и дефис; не начинается/не кончается дефисом; без двойных дефисов.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(nick) || nick.includes('--')) {
    return {
      ok: false,
      reason: 'nick_invalid',
      message: 'Только латиница, цифры и дефис (не в начале/конце, без двойных).',
    }
  }

  if (RESERVED_NICKS.has(nick)) {
    return { ok: false, reason: 'nick_invalid', message: 'Этот ник зарезервирован.' }
  }

  // HARDENING #7: ловим бренд-сквоттинг через разделители. `token-max`,
  // `vibe-coding` обходили подстрочную проверку (дефис разбивал слово); теперь
  // сначала схлопываем все дефисы и проверяем БРЕНД по схлопнутой форме.
  const collapsed = nick.replace(/-/g, '')
  if (BRAND_SUBSTRINGS.some((brand) => collapsed.includes(brand))) {
    return { ok: false, reason: 'nick_invalid', message: 'Ник не может содержать имя бренда.' }
  }

  if (BRAND_SUBSTRINGS.some((brand) => nick.includes(brand))) {
    return { ok: false, reason: 'nick_invalid', message: 'Ник не может содержать имя бренда.' }
  }

  if (PROFANITY_SUBSTRINGS.some((bad) => nick.includes(bad))) {
    return { ok: false, reason: 'nick_invalid', message: 'Ник не прошёл модерацию.' }
  }

  return { ok: true, nick }
}

/** Ник занят → предложить следующий свободный вариант. */
export function suggestAlternativeNick(nick: string, taken: Set<string>): string {
  const base = normalizeNick(nick).slice(0, NICK_MAX - 2)
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`.slice(0, NICK_MAX)
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now() % 10000}`.slice(0, NICK_MAX)
}

// ---------------------------------------------------------------------------
// Анти-абьюз пороги
// ---------------------------------------------------------------------------

// HARDENING #6 (gray zone): суммы между soft и hard cap пропускаем, но метим
// suspicious (прячем из leaderboard). Soft cap ДОЛЖЕН быть ниже hard cap, иначе
// серая зона пуста; исходный 1_000_000 был выше нового hard cap (250k) и сделал
// бы зону suspicious недостижимой, поэтому опущен.
// Lowered 50k→15k: visible (non-suspicious) entries are bounded to a believable
// heavy-user ceiling, so self-reported poison can't show absurd numbers on the
// public board; above this → suspicious → hidden pending owner review.
export const TMX_VALUE_CAP_USD = 15_000

// HARDENING #6: жёсткий потолок — выше него публикация ОТКЛОНЯЕТСЯ (reason
// value_too_high), а не просто метится. Ограничивает абсурдные/абьюзные суммы.
export const TMX_VALUE_HARD_CAP_USD = 250_000

// HARDENING #2: глобальный дневной потолок платформы. Жёсткий ceiling на число
// успешных публикаций в сутки независимо от IP — бьёт по storage/cost при
// распределённой атаке (много IP). Считается в ops_tmx_counters.
export const GLOBAL_DAILY_CAP = 5000

// HARDENING #4: минимальный интервал между публикациями ОДНОГО ника.
export const TMX_NICK_MIN_INTERVAL_MS = 30 * 1000

export const TMX_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const TMX_RATE_LIMIT_MAX = 8

// HARDENING #3b: per-IP daily sub-cap. With a trustworthy client IP (rightmost
// XFF), one source can't burn the global daily cap or mass-create poison
// entries. Generous vs any legit use (publish once / a few re-runs per day).
export const TMX_IP_DAILY_CAP = 12

// ---------------------------------------------------------------------------
// Агрегация моделей → источники + тоталы (серверный авторитетный расчёт $)
// ---------------------------------------------------------------------------

export type TmxModelUsageInput = {
  model: string
  tool: string
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
}

export type TmxSource = {
  source: string
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxTotals = {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxDailyInput = { date: string; codexTokens: number; claudeTokens: number }
export type TmxDaily = TmxDailyInput & { totalTokens: number }

const SOURCE_LABELS: Record<TmxTool, string> = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyTotals(): TmxTotals {
  return {
    input: 0,
    output: 0,
    cacheCreate: 0,
    cacheRead: 0,
    reasoning: 0,
    totalTokens: 0,
    costUsd: 0,
  }
}

/**
 * Группирует per-model usage в источники (Codex / Claude Code) и считает
 * API-equivalent $ по каноничному pricing. Незнакомая модель → fallback-ставка
 * + флаг hasUnknownModels.
 */
export function aggregateModels(models: TmxModelUsageInput[]): {
  sources: TmxSource[]
  totals: TmxTotals
  hasUnknownModels: boolean
} {
  const byLabel = new Map<string, TmxSource>()
  let hasUnknownModels = false

  for (const m of models) {
    const rate = resolveModelRate(m.model)
    if (!rate) hasUnknownModels = true
    const perMillion = rate?.perMillion ?? TMX_FALLBACK_RATE
    const tool: TmxTool | 'other' =
      rate?.tool ?? (m.tool === 'codex' || m.tool === 'claude-code' ? m.tool : 'other')
    const label = tool === 'other' ? 'Other' : SOURCE_LABELS[tool]

    const usage = {
      input: Math.max(0, m.input),
      output: Math.max(0, m.output),
      cacheCreate: Math.max(0, m.cacheCreate),
      cacheRead: Math.max(0, m.cacheRead),
      reasoning: Math.max(0, m.reasoning),
    }
    const costUsd = costUsdForUsage(perMillion, usage)
    const tokens =
      usage.input + usage.output + usage.cacheCreate + usage.cacheRead + usage.reasoning

    const cur =
      byLabel.get(label) ??
      ({
        source: label,
        input: 0,
        output: 0,
        cacheCreate: 0,
        cacheRead: 0,
        reasoning: 0,
        totalTokens: 0,
        costUsd: 0,
      } satisfies TmxSource)

    cur.input += usage.input
    cur.output += usage.output
    cur.cacheCreate += usage.cacheCreate
    cur.cacheRead += usage.cacheRead
    cur.reasoning += usage.reasoning
    cur.totalTokens += tokens
    cur.costUsd += costUsd
    byLabel.set(label, cur)
  }

  const sources = Array.from(byLabel.values()).sort((a, b) => a.source.localeCompare(b.source))
  const totals = sources.reduce<TmxTotals>((t, s) => {
    t.input += s.input
    t.output += s.output
    t.cacheCreate += s.cacheCreate
    t.cacheRead += s.cacheRead
    t.reasoning += s.reasoning
    t.totalTokens += s.totalTokens
    t.costUsd += s.costUsd
    return t
  }, emptyTotals())

  for (const s of sources) s.costUsd = round2(s.costUsd)
  totals.costUsd = round2(totals.costUsd)

  return { sources, totals, hasUnknownModels }
}

/** Дополняет дневные столбики суммарными токенами и сортирует по дате. */
export function buildDaily(daily: TmxDailyInput[]): TmxDaily[] {
  return daily
    .map((d) => ({
      date: d.date,
      codexTokens: Math.max(0, d.codexTokens),
      claudeTokens: Math.max(0, d.claudeTokens),
      totalTokens: Math.max(0, d.codexTokens) + Math.max(0, d.claudeTokens),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const TMX_PROFILE_BASE_URL = 'https://tokmax.vibecoding.tech'

export function tmxProfileUrl(nick: string): string {
  return `${TMX_PROFILE_BASE_URL}/${nick}`
}
