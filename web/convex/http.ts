import { httpRouter, makeFunctionReference } from 'convex/server'
import { httpAction } from './_generated/server'
import { TMX_VALUE_HARD_CAP_USD } from './lib/tmx'
import { randomToken } from './lib/x_auth'

// ===========================================================================
// ===========================================================================

const http = httpRouter()

type TmxModelSpendPayload = {
  model: string
  tool: string
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

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
  modelSpend?: TmxModelSpendPayload[]
  dailyModelSpend?: Array<{
    date: string
    models: TmxModelSpendPayload[]
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
      reason: 'nick_invalid' | 'nick_taken' | 'rate_limited' | 'empty_usage' | 'value_too_high'
      message?: string
      suggestion?: string
    }

const tmxPublish = makeFunctionReference<'mutation', TmxPublishArgs, TmxPublishResult>(
  'tables/data_raw_tmx_submissions:publish'
)

//
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

// Self-service delete: purge ALL data for a nick (profile + submissions + claim
// + account + tokens). Called from /api/tmx/delete with the bearer-resolved handle.
const tmxPurgeNick = makeFunctionReference<
  'mutation',
  { nick: string },
  { nick: string; profiles: number; submissions: number; claims: number; accounts: number; tokens: number }
>('admin_tmx:purgeNick')

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

function tmxFloat(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const rounded = Math.round(n * 100) / 100
  return Math.min(Math.max(0, rounded), TMX_VALUE_HARD_CAP_USD)
}

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

function tmxCoerceModelSpend(raw: unknown): TmxPublishArgs['modelSpend'] {
  if (!Array.isArray(raw)) return undefined
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
      totalTokens: tmxInt(m?.totalTokens),
      costUsd: tmxFloat(m?.costUsd),
    }))
    .filter((m) => m.model.length > 0)
}

// Hard bound on how many raw per-day entries we even look at before sorting
// (DoS guard); the real cap is TMX_MAX_DAILY of the NEWEST days below.
const TMX_MAX_DAILY_RAW = 2000

// Keep the NEWEST days when truncating. A heavy user's history is longer than
// TMX_MAX_DAILY; keeping the oldest days would silently drop the current
// month — including the whole Fable 5 launch window — for exactly the users
// most likely to top the board.
function tmxNewestDays<T extends { date: string }>(days: T[]): T[] {
  return days
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, TMX_MAX_DAILY)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function tmxCoerceDailyModelSpend(raw: unknown): TmxPublishArgs['dailyModelSpend'] {
  if (!Array.isArray(raw)) return undefined
  const days = raw
    .slice(0, TMX_MAX_DAILY_RAW)
    .map((day) => ({
      date: typeof day?.date === 'string' ? day.date.slice(0, 10) : '',
      models: tmxCoerceModelSpend(day?.models) ?? [],
    }))
    .filter((day) => day.date.length > 0 && day.models.length > 0)
  return tmxNewestDays(days)
}

function tmxCoerceDaily(raw: unknown): TmxPublishArgs['daily'] {
  if (!Array.isArray(raw)) return []
  const days = raw
    .slice(0, TMX_MAX_DAILY_RAW)
    .map((d) => ({
      date: typeof d?.date === 'string' ? d.date.slice(0, 10) : '',
      codexTokens: tmxInt(d?.codexTokens),
      claudeTokens: tmxInt(d?.claudeTokens),
      costUsd: d?.costUsd == null ? undefined : tmxFloat(d?.costUsd),
    }))
    .filter((d) => d.date.length > 0)
  return tmxNewestDays(days)
}

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
    let salt = process.env.TMX_IP_SALT
    if (!salt) {
      salt = process.env.CONVEX_CLOUD_URL ?? process.env.CONVEX_SITE_URL ?? 'tmx-deployment-salt'
      console.warn(
        '[tmx] TMX_IP_SALT is not set — using per-deployment fallback salt. Set TMX_IP_SALT env for a stable, private salt.'
      )
    }
    const ipHash = await tmxSha256Hex(`${salt}:${ip}`)

    const authHeader = request.headers.get('authorization') ?? ''
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null
    let accountXUserId: string | null = null
    let accountNick: string | null = null
    if (bearer) {
      const tokenHash = await tmxSha256Hex(bearer)
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
      modelSpend: tmxCoerceModelSpend(body.modelSpend),
      dailyModelSpend: tmxCoerceDailyModelSpend(body.dailyModelSpend),
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
        url: `https://tokmax.dev/${result.nick}`,
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

//
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
    const machineLabel =
      typeof body.machine_label === 'string' && body.machine_label.trim().length > 0
        ? body.machine_label.slice(0, 60)
        : null
    if (!exchangeCode || !redeemSecret) {
      return tmxJson({ ok: false, reason: 'invalid_payload' }, 400)
    }

    const exchangeCodeHash = await tmxSha256Hex(exchangeCode)
    const redeemSecretHash = await tmxSha256Hex(redeemSecret)
    const token = randomToken(32)
    const tokenHash = await tmxSha256Hex(token)

    const result = await ctx.runMutation(tmxRedeemSession, {
      exchange_code_hash: exchangeCodeHash,
      redeem_secret_hash: redeemSecretHash,
    })
    if (!result.ok) {
      return tmxJson({ ok: false, reason: 'invalid_or_expired' }, 400)
    }
    await ctx.runMutation(tmxInsertToken, {
      account_x_user_id: result.x_user_id,
      token_hash: tokenHash,
      machine_label: machineLabel,
    })
    return tmxJson({ ok: true, token, handle: result.handle }, 200)
  }),
})

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

// delete (self-service): CLI sends Authorization: Bearer <token>. We resolve the
// account from the token and purge ALL of its data. The bearer proves ownership,
// so a user can only ever delete their OWN account. No request body needed.
http.route({
  path: '/api/tmx/delete',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get('authorization') ?? ''
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null
    if (!bearer) return tmxJson({ ok: false, reason: 'unauthorized' }, 401)
    const tokenHash = await tmxSha256Hex(bearer)
    const account = await ctx.runMutation(tmxResolveToken, { token_hash: tokenHash })
    if (!account) return tmxJson({ ok: false, reason: 'unauthorized' }, 401)
    const result = await ctx.runMutation(tmxPurgeNick, { nick: account.handle.toLowerCase() })
    return tmxJson({ ok: true, ...result }, 200)
  }),
})

export default http
