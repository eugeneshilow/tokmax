import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../_generated/server'

// "Sign in with X": верифицированный аккаунт (mutable display поверх
// иммутабельного x_user_id). Все мутации internal — пишутся только из action
// xAuth/http (после проверки подлинности X / токена). X access-токены тут НЕ
// хранятся; token_hash — SHA-256 от account-токена (сам токен наружу один раз).

/** Upsert аккаунта по immutable x_user_id; handle/name/avatar — refresh каждый логин. */
export const upsertAccount = internalMutation({
  args: {
    x_user_id: v.string(),
    handle: v.string(),
    name: v.string(),
    avatar_url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_x_user_id', (q) => q.eq('x_user_id', args.x_user_id))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        handle: args.handle,
        name: args.name,
        avatar_url: args.avatar_url,
        updated_at: now,
      })
    } else {
      await ctx.db.insert('biz_tmx_accounts', {
        x_user_id: args.x_user_id,
        handle: args.handle,
        name: args.name,
        avatar_url: args.avatar_url,
        token_hash: null,
        created_at: now,
        updated_at: now,
      })
    }
    return null
  },
})

/** Резолв аккаунта по SHA-256(account-токен) — для Bearer-публикации. */
export const getByTokenHash = internalQuery({
  args: { token_hash: v.string() },
  returns: v.union(
    v.object({ x_user_id: v.string(), handle: v.string() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_token_hash', (q) => q.eq('token_hash', args.token_hash))
      .unique()
    if (!account) return null
    return { x_user_id: account.x_user_id, handle: account.handle }
  },
})

/** logout/revoke: обнулить token_hash аккаунта, владеющего этим токеном. */
export const revokeByTokenHash = internalMutation({
  args: { token_hash: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_token_hash', (q) => q.eq('token_hash', args.token_hash))
      .unique()
    if (!account) return { ok: false }
    await ctx.db.patch(account._id, { token_hash: null, updated_at: Date.now() })
    return { ok: true }
  },
})
