import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { X_EXCHANGE_TTL_MS, X_SESSION_TTL_MS } from '../lib/x_auth'

// "Sign in with X": короткоживущая OAuth2-сессия. Все мутации internal и
// детерминированы — крипто (state/PKCE/exchange_code/token) делается выше, в
// action xAuth / httpAction; сюда приходят уже готовые значения и хеши.

/** begin: создать сессию авторизации (state уникален; TTL 10 мин). */
export const createSession = internalMutation({
  args: {
    state: v.string(),
    code_verifier: v.string(),
    port: v.number(),
    redeem_secret_hash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert('data_raw_tmx_auth_sessions', {
      state: args.state,
      code_verifier: args.code_verifier,
      port: args.port,
      redeem_secret_hash: args.redeem_secret_hash,
      exchange_code_hash: null,
      account_x_user_id: null,
      used: false,
      created_at: now,
      expires_at: now + X_SESSION_TTL_MS,
    })
    return null
  },
})

/**
 * complete (шаг 1): АТОМАРНО потребить сессию по state. Reject если
 * отсутствует / протухла / уже использована (replay/CSRF-защита). Помечает
 * used=true и возвращает code_verifier+port для обмена кода. cli_nonce/secret в
 * URL больше не уходят — loopback-redirect несёт только exchange_code.
 */
export const consumeSession = internalMutation({
  args: { state: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      code_verifier: v.string(),
      port: v.number(),
    }),
    v.object({ ok: v.literal(false) })
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('data_raw_tmx_auth_sessions')
      .withIndex('by_state', (q) => q.eq('state', args.state))
      .unique()
    if (!session) return { ok: false as const }
    if (session.used || Date.now() > session.expires_at) return { ok: false as const }

    // Атомарный consume в рамках одной мутации-транзакции.
    await ctx.db.patch(session._id, { used: true })
    return {
      ok: true as const,
      code_verifier: session.code_verifier,
      port: session.port,
    }
  },
})

/**
 * complete (шаг 2): привязать одноразовый exchange_code (хеш) + аккаунт к
 * сессии и переставить TTL на 60s (только loopback-redeem остаётся валидной
 * операцией). Реальный токен X к этому моменту уже отброшен.
 */
export const attachExchange = internalMutation({
  args: {
    state: v.string(),
    exchange_code_hash: v.string(),
    account_x_user_id: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('data_raw_tmx_auth_sessions')
      .withIndex('by_state', (q) => q.eq('state', args.state))
      .unique()
    if (!session) return null
    await ctx.db.patch(session._id, {
      exchange_code_hash: args.exchange_code_hash,
      account_x_user_id: args.account_x_user_id,
      expires_at: Date.now() + X_EXCHANGE_TTL_MS,
    })
    return null
  },
})

/**
 * redeem: АТОМАРНО потребить exchange_code (one-time + TTL + PKCE-style proof) и
 * вернуть identity аккаунта (handle + immutable x_user_id). Сам account-токен
 * генерится/хешится выше (httpAction) и кладётся в biz_tmx_account_tokens
 * отдельной мутацией — здесь токен НЕ пишется (multi-token: вход с новой машины
 * добавляет ряд, не инвалидируя другие).
 *
 * P1 (кража токена через перехват loopback-URL): связка — не cli_nonce (он
 * ехал бы в том же URL, что и exchange_code, и потому не защищал бы), а
 * redeem_secret_hash. CLI предъявляет сырой redeem_secret server-to-server;
 * сверяем SHA-256(redeem_secret) === сохранённый redeem_secret_hash ДО минта.
 * Секрет нигде не появляется в URL, поэтому утёкший exchange_code бесполезен.
 */
export const redeemSession = internalMutation({
  args: {
    exchange_code_hash: v.string(),
    redeem_secret_hash: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), handle: v.string(), x_user_id: v.string() }),
    v.object({ ok: v.literal(false) })
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('data_raw_tmx_auth_sessions')
      .withIndex('by_exchange_code_hash', (q) =>
        q.eq('exchange_code_hash', args.exchange_code_hash)
      )
      .unique()
    if (!session || !session.exchange_code_hash) return { ok: false as const }
    if (Date.now() > session.expires_at) return { ok: false as const }
    if (session.redeem_secret_hash !== args.redeem_secret_hash) return { ok: false as const }
    if (!session.account_x_user_id) return { ok: false as const }

    const account = await ctx.db
      .query('biz_tmx_accounts')
      .withIndex('by_x_user_id', (q) => q.eq('x_user_id', session.account_x_user_id as string))
      .unique()
    if (!account) return { ok: false as const }

    // Одноразовость: гасим exchange_code (повторный redeem невозможен). Токен в
    // biz_tmx_account_tokens пишет httpAction отдельной мутацией (insertToken).
    await ctx.db.patch(session._id, { exchange_code_hash: null })
    return { ok: true as const, handle: account.handle, x_user_id: account.x_user_id }
  },
})

/** Крон-уборка протухших сессий (bounded read по времени истечения). */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query('data_raw_tmx_auth_sessions')
      .withIndex('by_expires_at', (q) => q.lt('expires_at', now))
      .take(200)
    for (const s of expired) await ctx.db.delete(s._id)
    return { deleted: expired.length }
  },
})
