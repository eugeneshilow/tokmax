import { httpRouter, makeFunctionReference } from 'convex/server'
import { httpAction } from './_generated/server'
import { buildPricingFactPack } from './lib/tmx_pricing'

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
  daily: Array<{ date: string; codexTokens: number; claudeTokens: number }>
  ipHash: string
  providedSecretHash: string | null
  candidateSecretHash: string
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
    }))
    .filter((d) => d.date.length > 0)
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

    const providedSecret =
      typeof body.secret === 'string' && body.secret.length > 0 ? body.secret : null
    const providedSecretHash = providedSecret ? await tmxSha256Hex(providedSecret) : null
    const newSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
    const candidateSecretHash = await tmxSha256Hex(newSecret)

    const result = await ctx.runMutation(tmxPublish, {
      nick: body.nick,
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
      daily: tmxCoerceDaily(body.daily),
      ipHash,
      providedSecretHash,
      candidateSecretHash,
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
        // Короткая шер-ссылка (редиректит на tokenmax.vibecoding.ru/<nick>).
        url: `https://tokenmax.ru/${result.nick}`,
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
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }),
})

http.route({
  path: '/api/tmx/pricing',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(JSON.stringify(buildPricingFactPack()), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }),
})

http.route({
  path: '/api/tmx/pricing',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }),
})

export default http
