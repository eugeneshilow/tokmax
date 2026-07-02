import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  tmxDailyFields,
  tmxDailyModelSpendFields,
  tmxModelSpendFields,
  tmxModelUsageFields,
  tmxSourceFields,
  tmxTotalsFields,
} from './lib/tmx'


export default defineSchema({
  data_raw_tmx_submissions: defineTable({
    nick: v.string(),
    ipHash: v.string(),
    cliVersion: v.string(),
    pricingVersion: v.string(),
    machineLabel: v.string(),
    firstDay: v.string(),
    lastDay: v.string(),
    models: v.array(v.object(tmxModelUsageFields)),
    modelSpend: v.optional(v.array(v.object(tmxModelSpendFields))),
    dailyModelSpend: v.optional(v.array(v.object(tmxDailyModelSpendFields))),
    sources: v.array(v.object(tmxSourceFields)),
    daily: v.array(v.object(tmxDailyFields)),
    totals: v.object(tmxTotalsFields),
    costUsd: v.number(),
    suspicious: v.boolean(),
    subscriptionUsd: v.optional(v.number()),
    account_x_user_id: v.optional(v.string()),
    insertedAt: v.number(),
  })
    .index('by_nick_inserted', ['nick', 'insertedAt'])
    .index('by_ip_hash_inserted', ['ipHash', 'insertedAt'])
    .index('by_account_inserted', ['account_x_user_id', 'insertedAt']),

  data_cooked_tmx_profiles: defineTable({
    nick: v.string(),
    firstDay: v.string(),
    lastDay: v.string(),
    machineLabels: v.array(v.string()),
    sources: v.array(v.object(tmxSourceFields)),
    daily: v.array(v.object(tmxDailyFields)),
    modelSpend: v.optional(v.array(v.object(tmxModelSpendFields))),
    totals: v.object(tmxTotalsFields),
    costUsd: v.number(),
    totalTokens: v.number(),
    fable5CostUsd: v.optional(v.number()),
    fable5Tokens: v.optional(v.number()),
    fable5LaunchCostUsd: v.optional(v.number()),
    fable5LaunchTokens: v.optional(v.number()),
    submissionCount: v.number(),
    cliVersion: v.string(),
    suspicious: v.boolean(),
    // Window-scoped plausibility flag for the Fable 5 launch board: the
    // all-time `suspicious` gate would hide real whales (lifetime > cap) whose
    // launch-window spend is modest. Missing on profiles projected before the
    // event feature; they re-project on their next publish.
    fable5Suspicious: v.optional(v.boolean()),
    subscriptionUsd: v.optional(v.number()),
    // Set when the nick is claimed via X sign-in; unclaimed profiles render as
    // verified:false.
    account_x_user_id: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    name: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    firstSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_nick', ['nick'])
    .index('by_cost_usd', ['costUsd'])
    .index('by_suspicious_cost', ['suspicious', 'costUsd'])
    .index('by_suspicious_fable5_cost', ['suspicious', 'fable5CostUsd'])
    .index('by_suspicious_fable5_launch_cost', ['suspicious', 'fable5LaunchCostUsd'])
    .index('by_fable5_suspicious_launch_cost', ['fable5Suspicious', 'fable5LaunchCostUsd'])
    .index('by_updated_at', ['updatedAt']),

  biz_tmx_accounts: defineTable({
    x_user_id: v.string(),
    handle: v.string(),
    name: v.string(),
    avatar_url: v.string(),
    token_hash: v.union(v.string(), v.null()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_x_user_id', ['x_user_id'])
    .index('by_handle', ['handle']),

  biz_tmx_account_tokens: defineTable({
    account_x_user_id: v.string(),
    token_hash: v.string(),
    machine_label: v.union(v.string(), v.null()),
    created_at: v.number(),
    last_used_at: v.number(),
  })
    .index('by_token_hash', ['token_hash'])
    .index('by_account', ['account_x_user_id']),

  data_raw_tmx_auth_sessions: defineTable({
    state: v.string(),
    code_verifier: v.string(),
    port: v.number(),
    redeem_secret_hash: v.string(),
    exchange_code_hash: v.union(v.string(), v.null()),
    account_x_user_id: v.union(v.string(), v.null()),
    used: v.boolean(),
    created_at: v.number(),
    expires_at: v.number(),
  })
    .index('by_state', ['state'])
    .index('by_exchange_code_hash', ['exchange_code_hash'])
    .index('by_expires_at', ['expires_at']),

  ops_tmx_claims: defineTable({
    nick: v.string(),
    secretHash: v.string(),
    createdAt: v.number(),
    lastPublishAt: v.number(),
    publishCount: v.number(),
  }).index('by_nick', ['nick']),

  ops_tmx_counters: defineTable({
    day: v.string(),
    count: v.number(),
  }).index('by_day', ['day']),
})
