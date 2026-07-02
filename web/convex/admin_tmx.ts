import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { projectTmxProfile, projectTmxProfileForAccount } from './tables/data_cooked_tmx_profiles'

/**
 * Surgical cleanup: delete a nick's submissions with the given machineLabels,
 * then re-project the profile. Used for hostname-hygiene migrations (raw
 * hostnames published before the anonymized-label CLI) without nuking the
 * account/tokens the way purgeNick does — X logins on all machines survive.
 */
export const purgeSubmissionsByLabels = internalMutation({
  args: { nick: v.string(), labels: v.array(v.string()) },
  handler: async (ctx, { nick, labels }) => {
    const kill = new Set(labels)
    let deleted = 0

    const rows = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
      .collect()
    let accountXUserId: string | undefined
    for (const row of rows) {
      if (row.account_x_user_id) accountXUserId = row.account_x_user_id
      if (kill.has(row.machineLabel)) {
        await ctx.db.delete(row._id)
        deleted++
      }
    }

    if (accountXUserId) {
      await projectTmxProfileForAccount(ctx, accountXUserId, nick)
    } else {
      await projectTmxProfile(ctx, nick)
    }
    return { nick, deleted, remaining: rows.length - deleted }
  },
})

/**
 * Full purge: profile + submissions + claim + account + tokens for a nick.
 */
export const purgeNick = internalMutation({
  args: { nick: v.string() },
  handler: async (ctx, { nick }) => {
    let profiles = 0
    let submissions = 0
    let claims = 0
    let accounts = 0
    let tokens = 0

    const ps = await ctx.db
      .query('data_cooked_tmx_profiles')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .collect()
    for (const p of ps) {
      await ctx.db.delete(p._id)
      profiles++
    }

    const ss = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
      .collect()
    for (const s of ss) {
      await ctx.db.delete(s._id)
      submissions++
    }

    const cs = await ctx.db
      .query('ops_tmx_claims')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .collect()
    for (const c of cs) {
      await ctx.db.delete(c._id)
      claims++
    }

    const accs = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_handle', (q) => q.eq('handle', nick))
      .collect()
    for (const a of accs) {
      const tks = await ctx.db
        .query('biz_tmx_account_tokens')
        .withIndex('by_account', (q) => q.eq('account_x_user_id', a.x_user_id))
        .collect()
      for (const t of tks) {
        await ctx.db.delete(t._id)
        tokens++
      }
      await ctx.db.delete(a._id)
      accounts++
    }

    return { nick, profiles, submissions, claims, accounts, tokens }
  },
})
