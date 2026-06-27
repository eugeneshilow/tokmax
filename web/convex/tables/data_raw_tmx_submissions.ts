import { internalMutation } from '../_generated/server'
import {
  GLOBAL_DAILY_CAP,
  TMX_IP_DAILY_CAP,
  TMX_NICK_MIN_INTERVAL_MS,
  TMX_RATE_LIMIT_MAX,
  TMX_RATE_LIMIT_WINDOW_MS,
  TMX_VALUE_CAP_USD,
  TMX_VALUE_HARD_CAP_USD,
  aggregateModels,
  buildDaily,
  validateNick,
  vTmxPublishArgs,
  vTmxPublishResult,
} from '../lib/tmx'
import { projectTmxProfile } from './data_cooked_tmx_profiles'

const NICK_MAX = 30

/**
 * Единая транзакция приёма публикации (зовётся из http.ts после крипто-хешей):
 * валидация ника → серверный расчёт $ → анти-абьюз гейты → capability-token →
 * иммутабельный append → проекция снапшота. Всё детерминировано; крипто
 * (хеши IP/секрета, генерация секрета) сделано выше, в httpAction.
 */
export const publish = internalMutation({
  args: vTmxPublishArgs,
  returns: vTmxPublishResult,
  handler: async (ctx, args) => {
    // 1. Ник: формат + модерация.
    const nickCheck = validateNick(args.nick)
    if (!nickCheck.ok) {
      return { ok: false as const, reason: 'nick_invalid' as const, message: nickCheck.message }
    }
    const nick = nickCheck.nick

    // 2. Серверный авторитетный расчёт $ из присланных токенов.
    const { sources, totals, hasUnknownModels } = aggregateModels(args.models)
    if (totals.totalTokens <= 0) {
      return {
        ok: false as const,
        reason: 'empty_usage' as const,
        message: 'В логах не нашлось токенов для подсчёта.',
      }
    }
    const daily = buildDaily(args.daily)

    // HARDENING #6: value-cap = ОТКАЗ, не только флаг. Сумма выше жёсткого
    // потолка неправдоподобна (абьюз/мусор) → отклоняем. Серую зону
    // (> soft cap, <= hard cap) пропускаем, но метим suspicious (прячем из
    // leaderboard).
    if (totals.costUsd > TMX_VALUE_HARD_CAP_USD) {
      return {
        ok: false as const,
        reason: 'value_too_high' as const,
        message: 'Сумма неправдоподобна.',
      }
    }
    const suspicious = totals.costUsd > TMX_VALUE_CAP_USD

    const now = Date.now()

    // HARDENING #2: глобальный circuit-breaker. Жёсткий дневной потолок числа
    // публикаций по всей платформе — ограничивает storage/cost независимо от IP
    // (распределённая атака с тысяч IP обходит per-IP лимит, но не этот). Читаем
    // дневной счётчик ДО вставки; инкремент — только после успешной вставки.
    const day = new Date(now).toISOString().slice(0, 10)
    const counter = await ctx.db
      .query('ops_tmx_counters')
      .withIndex('by_day', (q) => q.eq('day', day))
      .unique()
    if ((counter?.count ?? 0) >= GLOBAL_DAILY_CAP) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'Дневной лимит платформы исчерпан.',
      }
    }

    // HARDENING #4: per-nick min-interval. Самая свежая публикация ника читается
    // через compound-индекс [nick, insertedAt] (take 1) — отбиваем спам-флуд
    // одним ником без чтения всей истории.
    const lastForNick = await ctx.db
      .query('data_raw_tmx_submissions')
      .withIndex('by_nick_inserted', (q) => q.eq('nick', nick))
      .order('desc')
      .take(1)
    if (lastForNick.length > 0 && now - lastForNick[0].insertedAt < TMX_NICK_MIN_INTERVAL_MS) {
      return {
        ok: false as const,
        reason: 'rate_limited' as const,
        message: 'Слишком часто для этого ника. Подожди немного.',
      }
    }

    // HARDENING #3: bounded rate-limit по ipHash. Compound-индекс
    // [ipHash, insertedAt] + .gte(windowStart).take(MAX+1) читает максимум MAX+1
    // строк, а не всю историю IP через .collect() (неогр. read = self-DoS).
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
        message: 'Слишком много публикаций подряд. Попробуй чуть позже.',
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
        message: 'Дневной лимит публикаций с этого адреса исчерпан.',
      }
    }

    // 3. Capability-token: первая публикация ника создаёт claim; апдейт требует
    // секрет. Владение по секрету, не по личности.
    const claim = await ctx.db
      .query('ops_tmx_claims')
      .withIndex('by_nick', (q) => q.eq('nick', nick))
      .unique()

    let created = false
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
      // Ник занят другим ключом → предложить свободный вариант.
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
        message: 'Этот ник уже занят другим ключом.',
        suggestion,
      }
    } else {
      await ctx.db.patch(claim._id, {
        lastPublishAt: now,
        publishCount: claim.publishCount + 1,
      })
    }

    // 4. Иммутабельный append (write-once факт).
    await ctx.db.insert('data_raw_tmx_submissions', {
      nick,
      ipHash: args.ipHash,
      cliVersion: args.cliVersion,
      pricingVersion: args.pricingVersion,
      machineLabel: args.machineLabel,
      firstDay: args.firstDay,
      lastDay: args.lastDay,
      models: args.models,
      sources,
      daily,
      totals,
      suspicious,
      hasUnknownModels,
      subscriptionUsd: args.subscriptionUsd,
      insertedAt: now,
    })

    // HARDENING #2: инкремент глобального счётчика — ТОЛЬКО после успешной
    // вставки (отказы потолок не съедают).
    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 })
    } else {
      await ctx.db.insert('ops_tmx_counters', { day, count: 1 })
    }

    // 5. Проекция снапшота профиля.
    await projectTmxProfile(ctx, nick)

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
