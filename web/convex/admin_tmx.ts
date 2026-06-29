import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Admin-only cleanup: полностью удалить ник с лидерборда (cooked-профиль + все
 * raw-сабмишены). Для чистки тестовых записей перед запуском / модерации.
 * Вызов: `npx convex run admin_tmx:purgeNick '{"nick":"..."}'`.
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

    // Legacy capability claim (ник, занятый по секрету).
    const cs = await ctx.db
      .query('ops_tmx_claims')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .collect()
    for (const c of cs) {
      await ctx.db.delete(c._id)
      claims++
    }

    // Полный снос X-идентичности: аккаунт(ы) с handle == nick + все их per-machine
    // токены. После этого `npx tokmax login` создаёт аккаунт заново с нуля.
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
