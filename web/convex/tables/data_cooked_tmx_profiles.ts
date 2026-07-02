import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import { internalMutation, query, type MutationCtx } from '../_generated/server'
import {
  FABLE5_LEADERBOARD_DATA_END,
  FABLE5_LEADERBOARD_START,
  FABLE5_WINDOW_VALUE_CAP_USD,
  TMX_VALUE_CAP_USD,
  dateInFable5LeaderboardWindow,
  isFable5ModelId,
  tmxDailyFields,
  tmxModelSpendFields,
  tmxSourceFields,
  tmxTotalsFields,
  type TmxDaily,
  type TmxModelSpend,
  type TmxSource,
  type TmxTotals,
} from '../lib/tmx'

const vTmxProfilePublic = v.object({
  nick: v.string(),
  firstDay: v.string(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  sources: v.array(v.object(tmxSourceFields)),
  daily: v.array(v.object(tmxDailyFields)),
  modelSpend: v.array(v.object(tmxModelSpendFields)),
  totals: v.object(tmxTotalsFields),
  costUsd: v.number(),
  totalTokens: v.number(),
  fable5CostUsd: v.number(),
  fable5Tokens: v.number(),
  fable5LaunchCostUsd: v.number(),
  fable5LaunchTokens: v.number(),
  submissionCount: v.number(),
  cliVersion: v.string(),
  suspicious: v.boolean(),
  subscriptionUsd: v.optional(v.number()),
  avatar_url: v.optional(v.string()),
  name: v.optional(v.string()),
  verified: v.optional(v.boolean()),
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
  avatar_url: v.optional(v.string()),
  verified: v.optional(v.boolean()),
})

const vTmxFable5LeaderboardRow = v.object({
  nick: v.string(),
  costUsd: v.number(),
  totalTokens: v.number(),
  fable5CostUsd: v.number(),
  fable5Tokens: v.number(),
  fable5LaunchCostUsd: v.number(),
  fable5LaunchTokens: v.number(),
  allCostUsd: v.number(),
  allTotalTokens: v.number(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  updatedAt: v.number(),
  avatar_url: v.optional(v.string()),
  verified: v.optional(v.boolean()),
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

const TMX_PROJECTOR_WINDOW = 60

/**
 */
export async function projectTmxProfile(ctx: MutationCtx, nick: string): Promise<void> {
  const rows = await ctx.db
    .query('data_raw_tmx_submissions')
    .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
    .order('desc')
    .take(TMX_PROJECTOR_WINDOW)
  await writeProfileFromRows(ctx, nick, rows, undefined)
}

/**
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

  const latestByMachine = new Map<string, Doc<'data_raw_tmx_submissions'>>()
  for (const row of rows) {
    const cur = latestByMachine.get(row.machineLabel)
    if (!cur || row.insertedAt > cur.insertedAt) latestByMachine.set(row.machineLabel, row)
  }
  const latest = Array.from(latestByMachine.values())

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

  const modelSpendMap = new Map<string, TmxModelSpend>()
  for (const machine of latest) {
    for (const m of machine.modelSpend ?? []) {
      const key = `${m.tool}|${m.model}`
      const cur =
        modelSpendMap.get(key) ??
        ({
          model: m.model,
          tool: m.tool,
          input: 0,
          output: 0,
          cacheCreate: 0,
          cacheRead: 0,
          reasoning: 0,
          totalTokens: 0,
          costUsd: 0,
        } satisfies TmxModelSpend)
      cur.input += m.input
      cur.output += m.output
      cur.cacheCreate += m.cacheCreate
      cur.cacheRead += m.cacheRead
      cur.reasoning += m.reasoning
      cur.totalTokens += m.totalTokens
      cur.costUsd += m.costUsd
      modelSpendMap.set(key, cur)
    }
  }
  const modelSpend = Array.from(modelSpendMap.values())
    .map((m) => ({ ...m, costUsd: round2(m.costUsd) }))
    .sort((a, b) => b.costUsd - a.costUsd || a.tool.localeCompare(b.tool) || a.model.localeCompare(b.model))

  const fable5Rows = modelSpend.filter((m) => isFable5ModelId(m.model))
  const fable5CostUsd = round2(fable5Rows.reduce((sum, m) => sum + m.costUsd, 0))
  const fable5Tokens = fable5Rows.reduce((sum, m) => sum + m.totalTokens, 0)

  let fable5LaunchCostUsd = 0
  let fable5LaunchTokens = 0
  for (const machine of latest) {
    if (machine.dailyModelSpend && machine.dailyModelSpend.length > 0) {
      for (const day of machine.dailyModelSpend) {
        if (!dateInFable5LeaderboardWindow(day.date)) continue
        for (const m of day.models) {
          if (!isFable5ModelId(m.model)) continue
          fable5LaunchCostUsd += m.costUsd
          fable5LaunchTokens += m.totalTokens
        }
      }
      continue
    }

    // Back-compat for the short-lived modelSpend-only payload: if a machine's
    // entire publish window is inside the launch board window, all-time
    // modelSpend is safe to use. Mixed windows are intentionally ignored so
    // pre-July usage never leaks into the launch rank.
    if (
      machine.firstDay >= FABLE5_LEADERBOARD_START &&
      machine.lastDay <= FABLE5_LEADERBOARD_DATA_END
    ) {
      for (const m of machine.modelSpend ?? []) {
        if (!isFable5ModelId(m.model)) continue
        fable5LaunchCostUsd += m.costUsd
        fable5LaunchTokens += m.totalTokens
      }
    }
  }
  fable5LaunchCostUsd = round2(fable5LaunchCostUsd)

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
  const newestRow = rows[0]
  const firstSeenAt = rows.reduce((min, r) => Math.min(min, r.insertedAt), rows[0].insertedAt)
  const submissionSuspicious = latest.some((m) => m.suspicious)
  const suspicious = submissionSuspicious || totals.costUsd > TMX_VALUE_CAP_USD
  // Launch-board gate is window-scoped (see FABLE5_WINDOW_VALUE_CAP_USD):
  // lifetime whales stay eligible as long as their July window is plausible.
  const fable5Suspicious =
    submissionSuspicious || fable5LaunchCostUsd > FABLE5_WINDOW_VALUE_CAP_USD
  const now = Date.now()

  let avatarUrl: string | undefined
  let accountName: string | undefined
  let verified = false
  if (accountXUserId) {
    verified = true
    const account = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_x_user_id', (q) => q.eq('x_user_id', accountXUserId))
      .unique()
    if (account) {
      avatarUrl = account.avatar_url
      accountName = account.name
    }
  }

  const doc = {
    nick,
    firstDay,
    lastDay,
    machineLabels,
    sources,
    daily,
    modelSpend,
    totals,
    costUsd: totals.costUsd,
    totalTokens: totals.totalTokens,
    fable5CostUsd,
    fable5Tokens,
    fable5LaunchCostUsd,
    fable5LaunchTokens,
    submissionCount: rows.length,
    cliVersion: newestRow.cliVersion,
    suspicious,
    fable5Suspicious,
    // MAX across machines, not newest-wins: machines detect their own local
    // plans (a laptop with Max + ChatGPT Pro reports $400, a desktop with only
    // Max reports $200). PROFIT/× divides the COMBINED burn, so newest-wins
    // overstated the ratio whenever the cheaper machine published last. Plans
    // overlap across one person's machines (same Max sub), so max ≈ the real
    // monthly bill; summing would double-count the shared plan.
    subscriptionUsd:
      latest.reduce((mx, m) => Math.max(mx, m.subscriptionUsd ?? 0), 0) || undefined,
    account_x_user_id: accountXUserId,
    avatar_url: avatarUrl,
    name: accountName,
    verified,
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

export const recomputeProfile = internalMutation({
  args: { nick: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Admin recompute must keep verified profiles verified: the plain nick
    // projector has no account context and would write verified:false / drop
    // the avatar. Recover the account from the newest submissions instead.
    const rows = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_nick_inserted', (q) => q.eq('nick', args.nick))
      .order('desc')
      .take(TMX_PROJECTOR_WINDOW)
    const withAccount = rows.find((r) => r.account_x_user_id)
    if (withAccount?.account_x_user_id) {
      await projectTmxProfileForAccount(ctx, withAccount.account_x_user_id, args.nick)
    } else {
      await projectTmxProfile(ctx, args.nick)
    }
    return null
  },
})

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
      modelSpend: profile.modelSpend ?? [],
      fable5CostUsd: profile.fable5CostUsd ?? 0,
      fable5Tokens: profile.fable5Tokens ?? 0,
      fable5LaunchCostUsd: profile.fable5LaunchCostUsd ?? 0,
      fable5LaunchTokens: profile.fable5LaunchTokens ?? 0,
      submissionCount: profile.submissionCount,
      cliVersion: profile.cliVersion,
      suspicious: profile.suspicious,
      subscriptionUsd: profile.subscriptionUsd,
      avatar_url: profile.avatar_url,
      name: profile.name,
      verified: profile.verified,
      firstSeenAt: profile.firstSeenAt,
      updatedAt: profile.updatedAt,
    }
  },
})

export const listLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vTmxLeaderboardRow),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
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
        avatar_url: row.avatar_url,
        verified: row.verified,
      }))
  },
})

/** Special leaderboard for the Fable 5 launch: rank by July 1-7, 2026 spend only. */
export const listFable5Leaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vTmxFable5LeaderboardRow),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200)
    const rows = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_fable5_suspicious_launch_cost', (q) =>
        q.eq('fable5Suspicious', false).gt('fable5LaunchCostUsd', 0)
      )
      .order('desc')
      .take(limit)

    return rows
      .map((row) => {
        const fable5CostUsd = row.fable5LaunchCostUsd ?? 0
        const fable5Tokens = row.fable5LaunchTokens ?? 0
        return {
          nick: row.nick,
          costUsd: fable5CostUsd,
          totalTokens: fable5Tokens,
          fable5CostUsd,
          fable5Tokens,
          fable5LaunchCostUsd: fable5CostUsd,
          fable5LaunchTokens: fable5Tokens,
          allCostUsd: row.costUsd,
          allTotalTokens: row.totalTokens,
          lastDay: row.lastDay,
          machineLabels: row.machineLabels,
          updatedAt: row.updatedAt,
          avatar_url: row.avatar_url,
          verified: row.verified,
        }
      })
  },
})

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const vTmxPeriodLeaderboardRow = v.object({
  nick: v.string(),
  costUsd: v.number(),
  totalTokens: v.number(),
  lastDay: v.string(),
  machineLabels: v.array(v.string()),
  updatedAt: v.number(),
  periodCostUsd: v.number(),
  avatar_url: v.optional(v.string()),
  verified: v.optional(v.boolean()),
})

const TMX_PERIOD_SCAN_CAP = 1000

function normalizePeriod(raw: string): string {
  if (raw === 'all') return 'all'
  if (/^\d{4}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  return 'all'
}

function dateInPeriod(date: string, period: string): boolean {
  if (period === 'all') return true
  if (period.length === 4) return date.slice(0, 4) === period
  return date.slice(0, 7) === period
}

/**
 */
export const listLeaderboardByPeriod = query({
  args: { period: v.string(), limit: v.optional(v.number()) },
  returns: v.array(vTmxPeriodLeaderboardRow),
  handler: async (ctx, args) => {
    const period = normalizePeriod(args.period)
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200)

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
            avatar_url: row.avatar_url,
            verified: row.verified,
          }
        }
        const blendedRate = row.totalTokens > 0 ? row.costUsd / row.totalTokens : 0
        let costUsd = 0
        let totalTokens = 0
        for (const d of row.daily) {
          if (!dateInPeriod(d.date, period)) continue
          costUsd += d.costUsd ?? d.totalTokens * blendedRate
          totalTokens += d.totalTokens
        }
        const periodCostUsd = round2(costUsd)
        return {
          nick: row.nick,
          costUsd: periodCostUsd,
          totalTokens,
          lastDay: row.lastDay,
          machineLabels: row.machineLabels,
          updatedAt: row.updatedAt,
          periodCostUsd,
          avatar_url: row.avatar_url,
          verified: row.verified,
        }
      })
      .filter((row) => period === 'all' || row.costUsd > 0)
      .sort((a, b) => b.costUsd - a.costUsd)

    return ranked.slice(0, limit)
  },
})
