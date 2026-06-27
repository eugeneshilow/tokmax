import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tmxDailyFields, tmxModelUsageFields, tmxSourceFields, tmxTotalsFields } from './lib/tmx'

// tokenmax (L2) — ISOLATED deployment. Эта схема содержит ТОЛЬКО tmx-таблицы:
// никакой платёжки/клиентов/email из основного сайта. Префикс tmx_ — короткий
// код таблиц (не бренд-слово). Канон зон data_/ops_ — docs/2-product/db/README.md.

export default defineSchema({
  // Сырьё публикаций ника: каждая публикация = иммутабельный атом (write-once).
  // ipHash — солёный хеш, не сырой IP (152-ФЗ: не-ПД), только для эфемерного
  // rate-limit. costUsd считает сервер из присланных токенов по
  // convex/lib/tmx_pricing, а не доверяет числу клиента.
  data_raw_tmx_submissions: defineTable({
    nick: v.string(),
    ipHash: v.string(),
    cliVersion: v.string(),
    pricingVersion: v.string(),
    machineLabel: v.string(),
    firstDay: v.string(),
    lastDay: v.string(),
    models: v.array(v.object(tmxModelUsageFields)),
    sources: v.array(v.object(tmxSourceFields)),
    daily: v.array(v.object(tmxDailyFields)),
    totals: v.object(tmxTotalsFields),
    suspicious: v.boolean(),
    hasUnknownModels: v.boolean(),
    subscriptionUsd: v.optional(v.number()),
    insertedAt: v.number(),
  })
    // HARDENING #4: [nick, insertedAt] — ограниченное чтение проектором
    // (последние N) + per-nick min-interval (последняя публикация ника).
    .index('by_nick_inserted', ['nick', 'insertedAt'])
    // HARDENING #3: [ipHash, insertedAt] — bounded rate-limit окном времени,
    // вместо .collect() всей истории IP.
    .index('by_ip_hash_inserted', ['ipHash', 'insertedAt']),

  // Снапшот-проекция профиля на ник (mutable, один ряд = один ник). costUsd и
  // totalTokens продублированы топ-уровнем для индекса leaderboard (V1).
  data_cooked_tmx_profiles: defineTable({
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
    .index('by_nick', ['nick'])
    .index('by_cost_usd', ['costUsd'])
    .index('by_updated_at', ['updatedAt']),

  // Анти-сквоттинг без identity: ник → secret_hash (capability-token). Апдейт
  // ника требует секрета (владение по секрету, не по личности); первая
  // публикация ника создаёт claim. Персональных данных нет.
  ops_tmx_claims: defineTable({
    nick: v.string(),
    secretHash: v.string(),
    createdAt: v.number(),
    lastPublishAt: v.number(),
    publishCount: v.number(),
  }).index('by_nick', ['nick']),

  // HARDENING #2: глобальный circuit-breaker. Один ряд на сутки (UTC, YYYY-MM-DD)
  // со счётчиком успешных публикаций. Жёсткий ceiling (GLOBAL_DAILY_CAP) bounds
  // storage/cost независимо от IP.
  ops_tmx_counters: defineTable({
    day: v.string(),
    count: v.number(),
  }).index('by_day', ['day']),
})
