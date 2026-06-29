import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'

// "Sign in with X" — multi-token store (one row per machine login).
//
// WHY: the old single token_hash on biz_tmx_accounts meant a 2nd machine login
// rotated (invalidated) the 1st machine's token, so multi-machine never truly
// worked. Each login now INSERTS its own token row here; a new login never
// touches another machine's row. Logout deletes THIS machine's row; logout-all
// deletes every row for the account.
//
// token_hash = SHA-256(account token); the raw token is shown to the CLI once
// (in the /redeem response body) and never stored. machine_label is best-effort
// (hostname) so the owner can recognise which device a token belongs to.

/** redeem: insert a fresh token for this machine — additive, never rotates others. */
export const insertToken = internalMutation({
  args: {
    account_x_user_id: v.string(),
    token_hash: v.string(),
    machine_label: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert('biz_tmx_account_tokens', {
      account_x_user_id: args.account_x_user_id,
      token_hash: args.token_hash,
      machine_label: args.machine_label,
      created_at: now,
      last_used_at: now,
    })
    return null
  },
})

/** publish: resolve the account by SHA-256(token) + touch last_used_at. */
export const resolveByTokenHash = internalMutation({
  args: { token_hash: v.string() },
  returns: v.union(v.object({ x_user_id: v.string(), handle: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query('biz_tmx_account_tokens')
      .withIndex('by_token_hash', (q) => q.eq('token_hash', args.token_hash))
      .unique()
    if (!token) return null
    const account = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_x_user_id', (q) => q.eq('x_user_id', token.account_x_user_id))
      .unique()
    if (!account) return null
    await ctx.db.patch(token._id, { last_used_at: Date.now() })
    return { x_user_id: account.x_user_id, handle: account.handle }
  },
})

/** logout (this machine): delete the row for this token. Best-effort ok flag. */
export const revokeByTokenHash = internalMutation({
  args: { token_hash: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query('biz_tmx_account_tokens')
      .withIndex('by_token_hash', (q) => q.eq('token_hash', args.token_hash))
      .unique()
    if (!token) return { ok: false }
    await ctx.db.delete(token._id)
    return { ok: true }
  },
})

/** logout --all: delete every token row for the account that owns this token. */
export const revokeAllForTokenHash = internalMutation({
  args: { token_hash: v.string() },
  returns: v.object({ ok: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query('biz_tmx_account_tokens')
      .withIndex('by_token_hash', (q) => q.eq('token_hash', args.token_hash))
      .unique()
    if (!token) return { ok: false, count: 0 }
    // Token rows per account = one per logged-in machine (a handful) — bounded.
    const rows = await ctx.db
      .query('biz_tmx_account_tokens')
      .withIndex('by_account', (q) => q.eq('account_x_user_id', token.account_x_user_id))
      .collect()
    for (const r of rows) await ctx.db.delete(r._id)
    return { ok: true, count: rows.length }
  },
})
