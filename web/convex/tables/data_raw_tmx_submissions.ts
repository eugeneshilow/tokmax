import { internalMutation } from '../_generated/server'
import {
  GLOBAL_DAILY_CAP,
  TMX_IP_DAILY_CAP,
  TMX_NICK_MIN_INTERVAL_MS,
  TMX_RATE_LIMIT_MAX,
  TMX_RATE_LIMIT_WINDOW_MS,
  TMX_VALUE_CAP_USD,
  TMX_VALUE_HARD_CAP_USD,
  buildDaily,
  normalizeNick,
  validateNick,
  vTmxPublishArgs,
  vTmxPublishResult,
} from '../lib/tmx'
import { projectTmxProfile, projectTmxProfileForAccount } from './data_cooked_tmx_profiles'

const NICK_MAX = 30

/**
 */
export const publish = internalMutation({
  args: vTmxPublishArgs,
  returns: vTmxPublishResult,
  handler: async (ctx, args) => {
    const isAccount = args.account_x_user_id !== null

    let nick: string
    if (isAccount) {
      nick = normalizeNick(args.nick)
      if (nick.length === 0) {
        return { ok: false as const, reason: 'nick_invalid' as const, message: 'Empty handle.' }
      }
    } else {
      const nickCheck = validateNick(args.nick)
      if (!nickCheck.ok) {
        return { ok: false as const, reason: 'nick_invalid' as const, message: nickCheck.message }
      }
      nick = nickCheck.nick

      const ownedByAccount = await ctx.db
        .query('biz_tmx_accounts')
        .withIndex('by_handle', (q) => q.eq('handle', nick))
        .unique()
      if (ownedByAccount) {
        return {
          ok: false as const,
          reason: 'nick_taken' as const,
          message: 'This nick belongs to a verified X account. Sign in with X.',
        }
      }
    }

    const sources = args.sources
    const totals = args.totals
    const modelSpend = args.modelSpend ?? []
    const dailyModelSpend = args.dailyModelSpend ?? []
    if (totals.totalTokens <= 0) {
      return {
        ok: false as const,
        reason: 'empty_usage' as const,
        message: 'No token usage was found in the logs.',
      }
    }
    const daily = buildDaily(args.daily)
    const dailySum = daily.reduce((acc, d) => acc + d.costUsd, 0)
    const modelSpendSum = modelSpend.reduce((acc, m) => acc + m.costUsd, 0)
    const dailyModelSpendSum = dailyModelSpend.reduce(
      (acc, day) => acc + day.models.reduce((dayAcc, m) => dayAcc + m.costUsd, 0),
      0
    )

    if (
      totals.costUsd > TMX_VALUE_HARD_CAP_USD ||
      dailySum > TMX_VALUE_HARD_CAP_USD ||
      modelSpendSum > TMX_VALUE_HARD_CAP_USD ||
      dailyModelSpendSum > TMX_VALUE_HARD_CAP_USD
    ) {
      return {
        ok: false as const,
        reason: 'value_too_high' as const,
        message: 'The reported amount is not plausible.',
      }
    }
    const dailyDiverges = totals.costUsd > 0 && dailySum > totals.costUsd * 1.02 + 1
    const modelSpendDiverges =
      modelSpend.length > 0 && totals.costUsd > 0 && Math.abs(modelSpendSum - totals.costUsd) > totals.costUsd * 0.02 + 1
    const dailyModelSpendDiverges =
      dailyModelSpend.length > 0 &&
      totals.costUsd > 0 &&
      Math.abs(dailyModelSpendSum - totals.costUsd) > totals.costUsd * 0.02 + 1
    const suspicious =
      totals.costUsd > TMX_VALUE_CAP_USD ||
      dailySum > TMX_VALUE_CAP_USD ||
      modelSpendSum > TMX_VALUE_CAP_USD ||
      dailyModelSpendSum > TMX_VALUE_CAP_USD ||
      dailyDiverges ||
      modelSpendDiverges ||
      dailyModelSpendDiverges

    const now = Date.now()

    const day = new Date(now).toISOString().slice(0, 10)
    const counter = await ctx.db
      .query('ops_tmx_counters')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    if ((counter?.count ?? 0) >= GLOBAL_DAILY_CAP) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'The platform daily publish limit has been reached.',
      }
    }

    const lastForNick = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
      .order('desc')
      .take(1)
    if (lastForNick.length > 0 && now - lastForNick[0].insertedAt < TMX_NICK_MIN_INTERVAL_MS) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'Too frequent for this nick. Try again shortly.',
      }
    }

    const windowStart = now - TMX_RATE_LIMIT_WINDOW_MS
    const recent = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_ip_hash_inserted', (q) =>
        q.eq('ipHash', args.ipHash).gte('insertedAt', windowStart)
      )
      .take(TMX_RATE_LIMIT_MAX + 1)
    if (recent.length >= TMX_RATE_LIMIT_MAX) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'Too many publishes in a row. Try again later.',
      }
    }

    // HARDENING #3b: per-IP daily sub-cap (bounded read via compound index).
    // With a trustworthy client IP (rightmost XFF), one source can't burn the
    // global daily cap or mass-create poison entries.
    const dayStartMs = Date.parse(`${day}T00:00:00.000Z`)
    const ipToday = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_ip_hash_inserted', (q) =>
        q.eq('ipHash', args.ipHash).gte('insertedAt', dayStartMs)
      )
      .take(TMX_IP_DAILY_CAP + 1)
    if (ipToday.length >= TMX_IP_DAILY_CAP) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'The daily publish limit for this address has been reached.',
      }
    }

    let created = false
    if (isAccount) {
      const staleClaim = await ctx.db
        .query('ops_tmx_claims')
        .withIndex('by_nick', (q) => q.eq('nick', nick))
        .unique()
      if (staleClaim) await ctx.db.delete(staleClaim._id)
    } else {
      const claim = await ctx.db
        .query('ops_tmx_claims')
        .withIndex('by_nick', (q) => q.eq('nick', nick))
        .unique()

      if (!claim) {
        await ctx.db.insert('ops_tmx_claims', {
          nick,
          secretHash: args.candidateSecretHash,
          createdAt: now,
          lastPublishAt: now,
          publishCount: 1,
        })
        created = true
      } else if (args.providedSecretHash !== claim.secretHash) {
        let suggestion = `${nick}-2`.slice(0, NICK_MAX)
        for (let i = 2; i <= 12; i += 1) {
          const candidate = `${nick}-${i}`.slice(0, NICK_MAX)
          const taken = await ctx.db
            .query('ops_tmx_claims')
            .withIndex('by_nick', (q) => q.eq('nick', candidate))
            .unique()
          if (!taken) {
            suggestion = candidate
            break
          }
        }
        return {
          ok: false as const,
          reason: 'nick_taken' as const,
          message: 'This nick is already claimed by another key.',
          suggestion,
        }
      } else {
        await ctx.db.patch(claim._id, {
          lastPublishAt: now,
          publishCount: claim.publishCount + 1,
        })
      }
    }

    await ctx.db.insert('data_raw_tmx_submissions', {
      nick,
      ipHash: args.ipHash,
      cliVersion: args.cliVersion,
      pricingVersion: args.pricingVersion,
      machineLabel: args.machineLabel,
      firstDay: args.firstDay,
      lastDay: args.lastDay,
      models: args.models,
      ...(modelSpend.length ? { modelSpend } : {}),
      ...(dailyModelSpend.length ? { dailyModelSpend } : {}),
      sources,
      daily,
      totals,
      costUsd: totals.costUsd,
      suspicious,
      subscriptionUsd: args.subscriptionUsd,
      account_x_user_id: args.account_x_user_id ?? undefined,
      insertedAt: now,
    })

    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 })
    } else {
      await ctx.db.insert('ops_tmx_counters', { day, count: 1 })
    }

    if (isAccount && args.account_x_user_id) {
      await projectTmxProfileForAccount(ctx, args.account_x_user_id, nick)
    } else {
      await projectTmxProfile(ctx, nick)
    }

    return {
      ok: true as const,
      created,
      nick,
      suspicious,
      costUsd: totals.costUsd,
      totalTokens: totals.totalTokens,
    }
  },
})
