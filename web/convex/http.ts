import { httpRouter, makeFunctionReference } from 'convex/server'
import { httpAction } from './_generated/server'
import { TMX_VALUE_HARD_CAP_USD } from './lib/tmx'
import { randomToken } from './lib/x_auth'

// ===========================================================================
// tokenmax self-serve platform (L2) — публичный self-serve приём (ISOLATED).
// Публичный (без bearer): аноним по дизайну. Защита — capability-token на
// апдейт + rate-limit по ipHash + value-cap + модерация ника + глобальный
// дневной потолок + kill-switch. Крипто (хеши IP/секрета, генерация секрета)
// здесь, в httpAction (не в детерминированной мутации).
// ===========================================================================

const http = httpRouter()

type TmxPublishArgs = {
  nick: string
  cliVersion: string
  pricingVersion: string
  firstDay: string
  lastDay: string
  machineLabel: string
  models: Array<{
    model: string
    tool: string
    input: number
    output: number
    cacheCreate: number
    cacheRead: number
    reasoning: number
  }>
  sources: Array<{
    source: string
    input: number
    output: number
    cacheCreate: number
    cacheRead: number
    reasoning: number
    totalTokens: number
    costUsd: number
  }>
  totals: {
    input: number
    output: number
    cacheCreate: number
    cacheRead: number
    reasoning: number
    totalTokens: number
    costUsd: number
  }
  daily: Array<{ date: string; codexTokens: number; claudeTokens: number; costUsd?: number }>
  ipHash: string
  providedSecretHash: string | null
  candidateSecretHash: string
  account_x_user_id: string | null
  subscriptionUsd?: number
}

type TmxPublishResult =
  | {
      ok: true
      created: boolean
      nick: string
      suspicious: boolean
      costUsd: number
      totalTokens: number
    }
  | {
      ok: false
      // HARDENING #6: value_too_high — жёсткий value-cap отклоняет публикацию.
      reason: 'nick_invalid' | 'nick_taken' | 'rate_limited' | 'empty_usage' | 'value_too_high'
      message?: string
      suggestion?: string
    }

const tmxPublish = makeFunctionReference<'mutation', TmxPublishArgs, TmxPublishResult>(
  'tables/data_raw_tmx_submissions:publish'
)

// "Sign in with X" — internal-функции БД для Bearer-публикации, loopback-redeem
// и logout/revoke. makeFunctionReference (без зависимости от codegen).
//
// Multi-token: account-токены живут в biz_tmx_account_tokens (по ряду на
// машину). resolveByTokenHash резолвит аккаунт по SHA-256(token) + трогает
// last_used_at; insertToken добавляет токен новой машины; revoke* удаляют ряды.
const tmxResolveToken = makeFunctionReference<
  'mutation',
  { token_hash: string },
  { x_user_id: string; handle: string } | null
>('tables/biz_tmx_account_tokens:resolveByTokenHash')

const tmxInsertToken = makeFunctionReference<
  'mutation',
  { account_x_user_id: string; token_hash: string; machine_label: string | null },
  null
>('tables/biz_tmx_account_tokens:insertToken')

const tmxRevokeToken = makeFunctionReference<
  'mutation',
  { token_hash: string },
  { ok: boolean }
>('tables/biz_tmx_account_tokens:revokeByTokenHash')

const tmxRevokeAllTokens = makeFunctionReference<
  'mutation',
  { token_hash: string },
  { ok: boolean; count: number }
>('tables/biz_tmx_account_tokens:revokeAllForTokenHash')

const tmxRedeemSession = makeFunctionReference<
  'mutation',
  { exchange_code_hash: string; redeem_secret_hash: string },
  { ok: true; handle: string; x_user_id: string } | { ok: false }
>('tables/data_raw_tmx_auth_sessions:redeemSession')

async function tmxSha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function tmxInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

// $ — дробное: tmxInt floor'ит и обнулил бы центы. Отдельный float-коэрсер:
// non-negative, finite, round до центов, clamp по жёсткому value-cap.
function tmxFloat(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const rounded = Math.round(n * 100) / 100
  return Math.min(Math.max(0, rounded), TMX_VALUE_HARD_CAP_USD)
}

// HARDENING #5: payload caps. Понижены до 40 моделей / 120 дневных строк
// (раньше 500/400) — bounds размер одной публикации (память мутации, storage).
const TMX_MAX_MODELS = 40
const TMX_MAX_DAILY = 120

function tmxCoerceModels(raw: unknown): TmxPublishArgs['models'] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, TMX_MAX_MODELS)
    .map((m) => ({
      model: typeof m?.model === 'string' ? m.model.slice(0, 80) : '',
      tool: typeof m?.tool === 'string' ? m.tool.slice(0, 40) : '',
      input: tmxInt(m?.input),
      output: tmxInt(m?.output),
      cacheCreate: tmxInt(m?.cacheCreate),
      cacheRead: tmxInt(m?.cacheRead),
      reasoning: tmxInt(m?.reasoning),
    }))
    .filter((m) => m.model.length > 0)
}

function tmxCoerceDaily(raw: unknown): TmxPublishArgs['daily'] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, TMX_MAX_DAILY)
    .map((d) => ({
      date: typeof d?.date === 'string' ? d.date.slice(0, 10) : '',
      codexTokens: tmxInt(d?.codexTokens),
      claudeTokens: tmxInt(d?.claudeTokens),
      // per-day $ (CLI считает; float). Старые клиенты не шлют → undefined.
      costUsd: d?.costUsd == null ? undefined : tmxFloat(d?.costUsd),
    }))
    .filter((d) => d.date.length > 0)
}

// Источники приходят от клиента (CLI считает $). Токены — int, costUsd — float.
function tmxCoerceSources(raw: unknown): TmxPublishArgs['sources'] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, TMX_MAX_MODELS)
    .map((s) => ({
      source: typeof s?.source === 'string' ? s.source.slice(0, 40) : '',
      input: tmxInt(s?.input),
      output: tmxInt(s?.output),
      cacheCreate: tmxInt(s?.cacheCreate),
      cacheRead: tmxInt(s?.cacheRead),
      reasoning: tmxInt(s?.reasoning),
      totalTokens: tmxInt(s?.totalTokens),
      costUsd: tmxFloat(s?.costUsd),
    }))
    .filter((s) => s.source.length > 0)
}

function tmxCoerceTotals(raw: unknown): TmxPublishArgs['totals'] {
  const t = (raw ?? {}) as Record<string, unknown>
  return {
    input: tmxInt(t.input),
    output: tmxInt(t.output),
    cacheCreate: tmxInt(t.cacheCreate),
    cacheRead: tmxInt(t.cacheRead),
    reasoning: tmxInt(t.reasoning),
    totalTokens: tmxInt(t.totalTokens),
    costUsd: tmxFloat(t.costUsd),
  }
}

function tmxJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

http.route({
  path: '/api/tmx/publish',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // HARDENING #1: kill-switch. Оператор может мгновенно вырубить публичный
    // приём через env TMX_PUBLISH_ENABLED=false (без редеплоя кода). Default —
    // включён (любое значение кроме строки "false").
    if (process.env.TMX_PUBLISH_ENABLED === 'false') {
      return tmxJson({ ok: false, reason: 'disabled' }, 503)
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return tmxJson({ ok: false, reason: 'invalid_json' }, 400)
    }

    if (!body || typeof body.nick !== 'string' || !Array.isArray(body.models)) {
      return tmxJson({ ok: false, reason: 'invalid_payload' }, 400)
    }

    // HARD-CUT pre-0.7 clients: since 0.7 the CLI computes $ and CARRIES it
    // (sources[] + totals.costUsd). The server is a dumb store — no recompute
    // fallback. A payload без totals/sources не может дать честный $, поэтому
    // отклоняем, а не пишем строку с costUsd=0 (которая отравила бы leaderboard).
    const totalsObj =
      body.totals && typeof body.totals === 'object' ? (body.totals as Record<string, unknown>) : null
    if (!Array.isArray(body.sources) || !totalsObj || !Number.isFinite(Number(totalsObj.costUsd))) {
      return tmxJson(
        { ok: false, reason: 'invalid_payload', message: 'Update: npx tokmax@latest' },
        400
      )
    }

    const forwarded = request.headers.get('x-forwarded-for') ?? ''
    // HARDENING #3 fix: take the RIGHTMOST x-forwarded-for entry — the value the
    // platform edge appended (the real connecting IP). The leftmost is fully
    // client-controlled (spoofable), which defeated the salted per-IP rate-limit.
    const xffParts = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const ip = xffParts.length ? xffParts[xffParts.length - 1] : 'unknown'
    // HARDENING #8: НЕ публичная константа-соль. Читаем TMX_IP_SALT; если не
    // задан — fallback на per-deployment значение (URL развёртывания уникален
    // на деплой) + warning в логи, чтобы оператор выставил TMX_IP_SALT. Не
    // крашимся. ipHash — лишь для эфемерного rate-limit; сырая строка соли
    // наружу не уходит, в ряд пишется только солёный хеш.
    let salt = process.env.TMX_IP_SALT
    if (!salt) {
      salt = process.env.CONVEX_CLOUD_URL ?? process.env.CONVEX_SITE_URL ?? 'tmx-deployment-salt'
      console.warn(
        '[tmx] TMX_IP_SALT is not set — using per-deployment fallback salt. Set TMX_IP_SALT env for a stable, private salt.'
      )
    }
    const ipHash = await tmxSha256Hex(`${salt}:${ip}`)

    // "Sign in with X" path: Bearer account-токен → резолвим аккаунт по
    // SHA-256(token). Найден → публикуем под handle аккаунта (account_x_user_id),
    // legacy capability-secret игнорируется. Не найден → 401 (токен невалиден/
    // отозван), мутацию не зовём. Нет Bearer → legacy путь (как раньше).
    const authHeader = request.headers.get('authorization') ?? ''
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null
    let accountXUserId: string | null = null
    let accountNick: string | null = null
    if (bearer) {
      const tokenHash = await tmxSha256Hex(bearer)
      // Multi-token: резолвим аккаунт по ряду токена этой машины (+ last_used_at).
      const account = await ctx.runMutation(tmxResolveToken, { token_hash: tokenHash })
      if (!account) {
        return tmxJson({ ok: false, reason: 'unauthorized' }, 401)
      }
      accountXUserId = account.x_user_id
      accountNick = account.handle
    }

    const providedSecret =
      typeof body.secret === 'string' && body.secret.length > 0 ? body.secret : null
    const providedSecretHash = providedSecret ? await tmxSha256Hex(providedSecret) : null
    const newSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
    const candidateSecretHash = await tmxSha256Hex(newSecret)

    const result = await ctx.runMutation(tmxPublish, {
      // Account-путь: ник всегда = handle аккаунта (нельзя выдать себя за другой
      // ник). Legacy: ник из тела.
      nick: accountNick ?? body.nick,
      cliVersion: typeof body.cliVersion === 'string' ? body.cliVersion.slice(0, 40) : 'unknown',
      pricingVersion:
        typeof body.pricingVersion === 'string' ? body.pricingVersion.slice(0, 40) : 'unknown',
      firstDay: typeof body.firstDay === 'string' ? body.firstDay.slice(0, 10) : '',
      lastDay: typeof body.lastDay === 'string' ? body.lastDay.slice(0, 10) : '',
      machineLabel:
        typeof body.machineLabel === 'string' && body.machineLabel.trim().length > 0
          ? body.machineLabel.slice(0, 60)
          : 'this machine',
      models: tmxCoerceModels(body.models),
      sources: tmxCoerceSources(body.sources),
      totals: tmxCoerceTotals(body.totals),
      daily: tmxCoerceDaily(body.daily),
      ipHash,
      providedSecretHash,
      candidateSecretHash,
      account_x_user_id: accountXUserId,
      subscriptionUsd:
        typeof body.subscriptionUsd === 'number' &&
        Number.isFinite(body.subscriptionUsd) &&
        body.subscriptionUsd > 0
          ? Math.min(Math.round(body.subscriptionUsd * 100) / 100, 100_000)
          : undefined,
    })

    if (!result.ok) {
      // HARDENING #6: value_too_high → 400 (через default ветку).
      const status =
        result.reason === 'nick_taken' ? 409 : result.reason === 'rate_limited' ? 429 : 400
      return tmxJson(
        {
          ok: false,
          reason: result.reason,
          message: result.message,
          suggestion: result.suggestion,
        },
        status
      )
    }

    return tmxJson(
      {
        ok: true,
        created: result.created,
        nick: result.nick,
        // Канонический served URL профиля.
        url: `https://tokmax.vibecoding.tech/${result.nick}`,
        suspicious: result.suspicious,
        costUsd: result.costUsd,
        totalTokens: result.totalTokens,
        ...(result.created ? { secret: newSecret } : {}),
      },
      200
    )
  }),
})

http.route({
  path: '/api/tmx/publish',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }),
})

// ===========================================================================
// "Sign in with X" — loopback CLI endpoints (server-to-server).
// ===========================================================================

// redeem: CLI loopback POST'ит сюда {exchange_code, redeem_secret}. Реальный
// account-токен возвращается в ТЕЛЕ ответа (никогда в URL). Сервер генерит
// высокоэнтропийный токен, хранит только его SHA-256, отдаёт plaintext один раз.
//
// P1 (кража токена через перехват loopback-URL): redeem_secret — PKCE-style
// доказательство владения, которое CLI держит у себя и шлёт server-to-server
// (никогда в URL). Сверяем SHA-256(redeem_secret) с сохранённым на сессии
// redeem_secret_hash. exchange_code сам по себе (то, что уехало в loopback-URL)
// не редимится — без redeem_secret он бесполезен.
http.route({
  path: '/api/auth/x/redeem',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return tmxJson({ ok: false, reason: 'invalid_json' }, 400)
    }
    const exchangeCode = typeof body.exchange_code === 'string' ? body.exchange_code : ''
    const redeemSecret = typeof body.redeem_secret === 'string' ? body.redeem_secret : ''
    // best-effort метка машины (hostname) — для распознавания устройства владельцем.
    const machineLabel =
      typeof body.machine_label === 'string' && body.machine_label.trim().length > 0
        ? body.machine_label.slice(0, 60)
        : null
    if (!exchangeCode || !redeemSecret) {
      return tmxJson({ ok: false, reason: 'invalid_payload' }, 400)
    }

    const exchangeCodeHash = await tmxSha256Hex(exchangeCode)
    const redeemSecretHash = await tmxSha256Hex(redeemSecret)
    // Высокоэнтропийный отзываемый account-токен; храним только хеш.
    const token = randomToken(32)
    const tokenHash = await tmxSha256Hex(token)

    const result = await ctx.runMutation(tmxRedeemSession, {
      exchange_code_hash: exchangeCodeHash,
      redeem_secret_hash: redeemSecretHash,
    })
    if (!result.ok) {
      return tmxJson({ ok: false, reason: 'invalid_or_expired' }, 400)
    }
    // Multi-token: ДОБАВЛЯЕМ ряд токена этой машины (не инвалидируя другие).
    await ctx.runMutation(tmxInsertToken, {
      account_x_user_id: result.x_user_id,
      token_hash: tokenHash,
      machine_label: machineLabel,
    })
    return tmxJson({ ok: true, token, handle: result.handle }, 200)
  }),
})

// revoke (logout): CLI шлёт Authorization: Bearer <token>; удаляем ряд токена
// этой машины. Тело {all:true} → удаляем ВСЕ токены аккаунта (logout --all).
// Best-effort — всегда ok, чтобы не утекала инфа о валидности токена.
http.route({
  path: '/api/auth/x/revoke',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get('authorization') ?? ''
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null
    let all = false
    try {
      const body = (await request.json()) as Record<string, unknown>
      all = body?.all === true
    } catch {
      // Тело необязательно — без него выходим только на этой машине.
    }
    if (bearer) {
      const tokenHash = await tmxSha256Hex(bearer)
      if (all) {
        await ctx.runMutation(tmxRevokeAllTokens, { token_hash: tokenHash })
      } else {
        await ctx.runMutation(tmxRevokeToken, { token_hash: tokenHash })
      }
    }
    return tmxJson({ ok: true }, 200)
  }),
})

export default http
