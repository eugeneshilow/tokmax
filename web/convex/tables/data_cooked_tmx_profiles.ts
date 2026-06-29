import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import { internalMutation, query, type MutationCtx } from '../_generated/server'
import {
  TMX_VALUE_CAP_USD,
  tmxDailyFields,
  tmxSourceFields,
  tmxTotalsFields,
  type TmxDaily,
  type TmxSource,
  type TmxTotals,
} from '../lib/tmx'

// Публичная форма профиля (без системных полей Convex).
const vTmxProfilePublic = v.object({
  nick: v.string(),
  firstDay: v.string(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  sources: v.array(v.object(tmxSourceFields)),
  daily: v.array(v.object(tmxDailyFields)),
  totals: v.object(tmxTotalsFields),
  costUsd: v.number(),
  totalTokens: v.number(),
  submissionCount: v.number(),
  cliVersion: v.string(),
  suspicious: v.boolean(),
  subscriptionUsd: v.optional(v.number()),
  firstSeenAt: v.number(),
  updatedAt: v.number(),
})

const vTmxLeaderboardRow = v.object({
  nick: v.string(),
  costUsd: v.number(),
  totalTokens: v.number(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  updatedAt: v.number(),
})

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

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// HARDENING #4: верхняя граница строк, которые проектор читает на один ник.
// Раньше .collect() читал ВСЮ историю ника — неогр. read = self-DoS (ник с
// тысячами публикаций раздувает каждую проекцию). Берём только N последних:
// для снапшота важна последняя публикация на машину, а не вся история.
const TMX_PROJECTOR_WINDOW = 60

/**
 * Проектор (по нику, legacy capability-secret): иммутабельные публикации ника →
 * mutable снапшот профиля. Берёт ПОСЛЕДНЮЮ публикацию на каждую машину
 * (machineLabel) и суммирует по машинам.
 */
export async function projectTmxProfile(ctx: MutationCtx, nick: string): Promise<void> {
  // HARDENING #4: ограниченное чтение через compound-индекс [nick, insertedAt]
  // (order desc → последние N), вместо .collect() всей истории ника.
  const rows = await ctx.db
    .query('data_raw_tmx_submissions')
    .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
    .order('desc')
    .take(TMX_PROJECTOR_WINDOW)
  await writeProfileFromRows(ctx, nick, rows, undefined)
}

/**
 * Проектор (по аккаунту, Sign in with X): группирует ВСЕ машины аккаунта по
 * immutable x_user_id и суммирует — 2-я машина с тем же X-логином авто-сливается
 * без ручного `--key`. Dedup по (account_x_user_id, machine_label). Профиль
 * пишется под nick=handle.
 */
export async function projectTmxProfileForAccount(
  ctx: MutationCtx,
  accountXUserId: string,
  nick: string
): Promise<void> {
  const rows = await ctx.db
    .query('data_raw_tmx_submissions')
    .withIndex('by_account_inserted', (q) => q.eq('account_x_user_id', accountXUserId))
    .order('desc')
    .take(TMX_PROJECTOR_WINDOW)
  await writeProfileFromRows(ctx, nick, rows, accountXUserId)
}

/**
 * Общий сборщик снапшота: дедуп последней публикации на машину, сумма источников
 * и дней, запись/обновление cooked-профиля под ник. accountXUserId проставляется
 * в профиль для account-профилей (legacy → undefined).
 */
async function writeProfileFromRows(
  ctx: MutationCtx,
  nick: string,
  rows: Doc<'data_raw_tmx_submissions'>[],
  accountXUserId: string | undefined
): Promise<void> {
  if (rows.length === 0) {
    const stale = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .unique()
    if (stale) await ctx.db.delete(stale._id)
    return
  }

  // Последняя публикация на каждую машину (внутри ограниченного окна).
  const latestByMachine = new Map<string, Doc<'data_raw_tmx_submissions'>>()
  for (const row of rows) {
    const cur = latestByMachine.get(row.machineLabel)
    if (!cur || row.insertedAt > cur.insertedAt) latestByMachine.set(row.machineLabel, row)
  }
  const latest = Array.from(latestByMachine.values())

  // Источники складываем по имени (Codex / Claude Code) поверх машин.
  const sourceMap = new Map<string, TmxSource>()
  for (const machine of latest) {
    for (const s of machine.sources) {
      const cur =
        sourceMap.get(s.source) ??
        ({
          source: s.source,
          input: 0,
          output: 0,
          cacheCreate: 0,
          cacheRead: 0,
          reasoning: 0,
          totalTokens: 0,
          costUsd: 0,
        } satisfies TmxSource)
      cur.input += s.input
      cur.output += s.output
      cur.cacheCreate += s.cacheCreate
      cur.cacheRead += s.cacheRead
      cur.reasoning += s.reasoning
      cur.totalTokens += s.totalTokens
      cur.costUsd += s.costUsd
      sourceMap.set(s.source, cur)
    }
  }
  const sources = Array.from(sourceMap.values()).sort((a, b) => a.source.localeCompare(b.source))
  for (const s of sources) s.costUsd = round2(s.costUsd)

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
  totals.costUsd = round2(totals.costUsd)

  // Дни складываем по дате поверх машин (токены + per-day $ для period-ранков).
  const dailyMap = new Map<string, TmxDaily>()
  for (const machine of latest) {
    for (const d of machine.daily) {
      const cur =
        dailyMap.get(d.date) ??
        ({
          date: d.date,
          codexTokens: 0,
          claudeTokens: 0,
          totalTokens: 0,
          costUsd: 0,
        } satisfies TmxDaily)
      cur.codexTokens += d.codexTokens
      cur.claudeTokens += d.claudeTokens
      cur.totalTokens += d.totalTokens
      // Back-compat: старая публикация без per-day $ → день стоит $0.
      cur.costUsd += d.costUsd ?? 0
      dailyMap.set(d.date, cur)
    }
  }
  const daily = Array.from(dailyMap.values())
    .map((d) => ({ ...d, costUsd: round2(d.costUsd) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const machineLabels = latest.map((m) => m.machineLabel).sort((a, b) => a.localeCompare(b))
  const firstDay = latest.reduce(
    (min, m) => (m.firstDay < min ? m.firstDay : min),
    latest[0].firstDay
  )
  const lastDay = latest.reduce((max, m) => (m.lastDay > max ? m.lastDay : max), latest[0].lastDay)
  // rows[0] — самый свежий (order desc).
  const newestRow = rows[0]
  // firstSeenAt считается по ограниченному окну, но реальный first seen
  // фиксируется лишь на ПЕРВОМ insert (path ниже не патчит firstSeenAt), поэтому
  // значение не «уплывает» при усечении окна.
  const firstSeenAt = rows.reduce((min, r) => Math.min(min, r.insertedAt), rows[0].insertedAt)
  const suspicious = latest.some((m) => m.suspicious) || totals.costUsd > TMX_VALUE_CAP_USD
  const now = Date.now()

  const doc = {
    nick,
    firstDay,
    lastDay,
    machineLabels,
    sources,
    daily,
    totals,
    costUsd: totals.costUsd,
    totalTokens: totals.totalTokens,
    // submissionCount считается по ограниченному окну (макс TMX_PROJECTOR_WINDOW)
    // — для UI «сколько публикаций» этого достаточно, точный исторический счёт
    // не нужен.
    submissionCount: rows.length,
    cliVersion: newestRow.cliVersion,
    suspicious,
    subscriptionUsd: newestRow.subscriptionUsd,
    account_x_user_id: accountXUserId,
    updatedAt: now,
  }

  const existing = await ctx.db
    .query('data_cooked_tmx_profiles')
    .withIndex('by_nick', (q) => q.eq('nick', nick))
    .unique()

  if (existing) {
    await ctx.db.patch(existing._id, doc)
  } else {
    await ctx.db.insert('data_cooked_tmx_profiles', { ...doc, firstSeenAt })
  }
}

/** Ручной/тестовый пересчёт профиля. */
export const recomputeProfile = internalMutation({
  args: { nick: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await projectTmxProfile(ctx, args.nick)
    return null
  },
})

/** Публичный профиль для SSR-страницы `https://tokmax.vibecoding.tech/[nick]`. */
export const getByNick = query({
  args: { nick: v.string() },
  returns: v.union(vTmxProfilePublic, v.null()),
  handler: async (ctx, args) => {
    const nick = args.nick.trim().toLowerCase()
    const profile = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .unique()

    if (!profile) return null

    return {
      nick: profile.nick,
      firstDay: profile.firstDay,
      lastDay: profile.lastDay,
      machineLabels: profile.machineLabels,
      sources: profile.sources,
      daily: profile.daily,
      totals: profile.totals,
      costUsd: profile.costUsd,
      totalTokens: profile.totalTokens,
      submissionCount: profile.submissionCount,
      cliVersion: profile.cliVersion,
      suspicious: profile.suspicious,
      subscriptionUsd: profile.subscriptionUsd,
      firstSeenAt: profile.firstSeenAt,
      updatedAt: profile.updatedAt,
    }
  },
})

/** Leaderboard (surface — V1): топ по API-equivalent $, без suspicious. */
export const listLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vTmxLeaderboardRow),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
    // Фильтр suspicious на уровне индекса (eq false), не после take: иначе
    // suspicious-кластер (топ by_cost_usd) заполняет окно и обнуляет лидерборд.
    const rows = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_suspicious_cost', (q) => q.eq('suspicious', false))
      .order('desc')
      .take(limit)

    return rows
      .slice(0, limit)
      .map((row) => ({
        nick: row.nick,
        costUsd: row.costUsd,
        totalTokens: row.totalTokens,
        lastDay: row.lastDay,
        machineLabels: row.machineLabels,
        updatedAt: row.updatedAt,
      }))
  },
})

// ---------------------------------------------------------------------------
// Month/year leaderboards: ранжируем сумму per-day costUsd за календарный период
// ---------------------------------------------------------------------------

// Period-ряд = форма listLeaderboard + явное period-поле. costUsd здесь —
// СТОИМОСТЬ ЗА ПЕРИОД (ranking value), не all-time; totalTokens — токены за тот
// же период; periodCostUsd дублирует costUsd явным именем для UI.
const vTmxPeriodLeaderboardRow = v.object({
  nick: v.string(),
  costUsd: v.number(),
  totalTokens: v.number(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  updatedAt: v.number(),
  periodCostUsd: v.number(),
})

// Bounded scan: читаем верх профилей по all-time $ через by_cost_usd (desc), и
// уже в памяти пересчитываем стоимость за период из daily[]. Полностью точного
// per-period индекса нет (period — произвольный месяц/год), поэтому ограничиваем
// чтение жёстким потолком вместо неогр. скана всей таблицы. Датасет мал; кап
// щедрый. Если профилей станет много, эволюция — отдельная period-агрегатная
// таблица (проектор пишет per-period суммы).
const TMX_PERIOD_SCAN_CAP = 1000

/** "all" | "YYYY" (год) | "YYYY-MM" (месяц). Невалидное → "all". */
function normalizePeriod(raw: string): string {
  if (raw === 'all') return 'all'
  if (/^\d{4}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  return 'all'
}

/** Дата YYYY-MM-DD попадает в период? (год = первые 4, месяц = первые 7). */
function dateInPeriod(date: string, period: string): boolean {
  if (period === 'all') return true
  if (period.length === 4) return date.slice(0, 4) === period
  return date.slice(0, 7) === period
}

/**
 * Leaderboard за календарный период (месяц/год/all-time). Ранжирует по сумме
 * per-day costUsd, чьи даты попадают в период; suspicious исключены. "all"
 * берёт all-time costUsd/totalTokens профиля напрямую (back-compat: профили без
 * per-day $ всё равно ранжируются). Чтение ограничено TMX_PERIOD_SCAN_CAP.
 */
export const listLeaderboardByPeriod = query({
  args: { period: v.string(), limit: v.optional(v.number()) },
  returns: v.array(vTmxPeriodLeaderboardRow),
  handler: async (ctx, args) => {
    const period = normalizePeriod(args.period)
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200)

    // Фильтр suspicious на уровне индекса (eq false), не после take: иначе
    // suspicious-кластер заполняет TMX_PERIOD_SCAN_CAP-окно и обнуляет лидерборд.
    const rows = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_suspicious_cost', (q) => q.eq('suspicious', false))
      .order('desc')
      .take(TMX_PERIOD_SCAN_CAP)

    const ranked = rows
      .map((row) => {
        if (period === 'all') {
          return {
            nick: row.nick,
            costUsd: row.costUsd,
            totalTokens: row.totalTokens,
            lastDay: row.lastDay,
            machineLabels: row.machineLabels,
            updatedAt: row.updatedAt,
            periodCostUsd: row.costUsd,
          }
        }
        let costUsd = 0
        let totalTokens = 0
        for (const d of row.daily) {
          if (!dateInPeriod(d.date, period)) continue
          costUsd += d.costUsd ?? 0
          totalTokens += d.totalTokens
        }
        return {
          nick: row.nick,
          costUsd: round2(costUsd),
          totalTokens,
          lastDay: row.lastDay,
          machineLabels: row.machineLabels,
          updatedAt: row.updatedAt,
          periodCostUsd: round2(costUsd),
        }
      })
      // Профили без активности в периоде (costUsd == 0) выпадают из ранга.
      .filter((row) => period === 'all' || row.costUsd > 0)
      .sort((a, b) => b.costUsd - a.costUsd)

    return ranked.slice(0, limit)
  },
})
