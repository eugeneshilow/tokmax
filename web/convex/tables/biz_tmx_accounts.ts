import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'


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
