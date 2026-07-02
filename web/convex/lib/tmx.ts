//

import { v } from 'convex/values'

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const tmxModelUsageFields = {
  model: v.string(),
  tool: v.string(),
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
}

export const tmxModelSpendFields = {
  ...tmxModelUsageFields,
  totalTokens: v.number(),
  costUsd: v.number(),
}

export const tmxDailyModelSpendFields = {
  date: v.string(),
  models: v.array(v.object(tmxModelSpendFields)),
}

export const tmxSourceFields = {
  source: v.string(),
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
  totalTokens: v.number(),
  costUsd: v.number(),
}

/**
 */
export const tmxDailyFields = {
  date: v.string(),
  codexTokens: v.number(),
  claudeTokens: v.number(),
  totalTokens: v.number(),
  costUsd: v.optional(v.number()),
}

export const tmxTotalsFields = {
  input: v.number(),
  output: v.number(),
  cacheCreate: v.number(),
  cacheRead: v.number(),
  reasoning: v.number(),
  totalTokens: v.number(),
  costUsd: v.number(),
}


export const vTmxModelUsageInput = v.object(tmxModelUsageFields)
export const vTmxModelSpendInput = v.object(tmxModelSpendFields)
export const vTmxDailyModelSpendInput = v.object(tmxDailyModelSpendFields)
export const vTmxDailyInput = v.object({
  date: v.string(),
  codexTokens: v.number(),
  claudeTokens: v.number(),
  costUsd: v.optional(v.number()),
})

export const vTmxPublishArgs = {
  nick: v.string(),
  cliVersion: v.string(),
  pricingVersion: v.string(),
  firstDay: v.string(),
  lastDay: v.string(),
  machineLabel: v.string(),
  models: v.array(vTmxModelUsageInput),
  // Optional for back-compat; new CLI versions send per-model $ so special
  // leaderboards can rank by model-specific spend without server repricing.
  modelSpend: v.optional(v.array(vTmxModelSpendInput)),
  // Optional for back-compat; fixed-window special boards need dates, so new
  // CLI versions also send per-day, per-model $.
  dailyModelSpend: v.optional(v.array(vTmxDailyModelSpendInput)),
  sources: v.array(v.object(tmxSourceFields)),
  totals: v.object(tmxTotalsFields),
  daily: v.array(vTmxDailyInput),
  ipHash: v.string(),
  providedSecretHash: v.union(v.string(), v.null()),
  candidateSecretHash: v.string(),
  account_x_user_id: v.union(v.string(), v.null()),
  subscriptionUsd: v.optional(v.number()),
}

export const vTmxPublishResult = v.union(
  v.object({
    ok: v.literal(true),
    created: v.boolean(),
    nick: v.string(),
    suspicious: v.boolean(),
    costUsd: v.number(),
    totalTokens: v.number(),
  }),
  v.object({
    ok: v.literal(false),
    reason: v.union(
      v.literal('nick_invalid'),
      v.literal('nick_taken'),
      v.literal('rate_limited'),
      v.literal('empty_usage'),
      v.literal('value_too_high')
    ),
    message: v.optional(v.string()),
    suggestion: v.optional(v.string()),
  })
)

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const NICK_MIN = 2
export const NICK_MAX = 30

const RESERVED_NICKS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'root',
  'support',
  'help',
  'about',
  'login',
  'logout',
  'signin',
  'signup',
  'account',
  'settings',
  'me',
  'you',
  'new',
  'edit',
  'null',
  'undefined',
  'none',
  'test',
  'tests',
  'pricing',
  'publish',
  'leaderboard',
  'og',
  'opengraph-image',
  'favicon',
  'robots',
  'sitemap',
  'assets',
  'static',
  'public',
  'privacy',
  'legal',
  'terms',
  'convex',
  'next',
  'system',
  'official',
  'vibecoding',
  'tokenmax',
  'tokenmaxxing',
])

const BRAND_SUBSTRINGS = ['vibecoding', 'tokenmaxxing', 'tokenmax']

// Moderation, not localization: RU entries stay even on an English-only
// product — the audience is global and RU slurs read fine in latin nicks' ears.
const PROFANITY_SUBSTRINGS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'faggot',
  'хуй',
  'хуя',
  'пизд',
  'ебан',
  'еба',
  'бля',
  'сука',
  'мудак',
  'гондон',
  'долбоеб',
  'пидор',
  'пидар',
  'нахуй',
]

export function normalizeNick(raw: string): string {
  return raw.trim().toLowerCase()
}

export type NickValidation =
  | { ok: true; nick: string }
  | { ok: false; reason: 'nick_invalid'; message: string }

export function validateNick(raw: string): NickValidation {
  const nick = normalizeNick(raw)

  if (nick.length < NICK_MIN || nick.length > NICK_MAX) {
    return {
      ok: false,
      reason: 'nick_invalid',
      message: `Nick must be ${NICK_MIN}-${NICK_MAX} characters.`,
    }
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(nick) || nick.includes('--')) {
    return {
      ok: false,
      reason: 'nick_invalid',
      message: 'Use lowercase letters, digits, and hyphens only; no edge or double hyphens.',
    }
  }

  if (RESERVED_NICKS.has(nick)) {
    return { ok: false, reason: 'nick_invalid', message: 'This nick is reserved.' }
  }

  const collapsed = nick.replace(/-/g, '')
  if (BRAND_SUBSTRINGS.some((brand) => collapsed.includes(brand))) {
    return { ok: false, reason: 'nick_invalid', message: 'Nick cannot contain the brand name.' }
  }

  if (BRAND_SUBSTRINGS.some((brand) => nick.includes(brand))) {
    return { ok: false, reason: 'nick_invalid', message: 'Nick cannot contain the brand name.' }
  }

  if (PROFANITY_SUBSTRINGS.some((bad) => nick.includes(bad))) {
    return { ok: false, reason: 'nick_invalid', message: 'Nick did not pass moderation.' }
  }

  return { ok: true, nick }
}

export function suggestAlternativeNick(nick: string, taken: Set<string>): string {
  const base = normalizeNick(nick).slice(0, NICK_MAX - 2)
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`.slice(0, NICK_MAX)
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now() % 10000}`.slice(0, NICK_MAX)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Lowered 50k→15k: visible (non-suspicious) entries are bounded to a believable
// heavy-user ceiling, so self-reported poison can't show absurd numbers on the
// public board; above this → suspicious → hidden pending owner review.
export const TMX_VALUE_CAP_USD = 15_000

export const TMX_VALUE_HARD_CAP_USD = 250_000

// Platform-wide daily publish budget. Raised 5k→20k for the Fable 5 launch
// window: at a viral peak the cap must throttle attackers, not the launch —
// per-IP caps below carry the real anti-abuse load.
export const GLOBAL_DAILY_CAP = 20_000

export const TMX_NICK_MIN_INTERVAL_MS = 30 * 1000

export const TMX_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const TMX_RATE_LIMIT_MAX = 8

// HARDENING #3b: per-IP daily sub-cap. With a trustworthy client IP (rightmost
// XFF), one source can't burn the global daily cap or mass-create poison
// entries. Generous vs any legit use (publish once / a few re-runs per day).
export const TMX_IP_DAILY_CAP = 12

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export type TmxSource = {
  source: string
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxModelSpend = {
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

export type TmxDailyModelSpend = {
  date: string
  models: TmxModelSpend[]
}

export type TmxTotals = {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxDailyInput = {
  date: string
  codexTokens: number
  claudeTokens: number
  costUsd?: number
}
export type TmxDaily = TmxDailyInput & { totalTokens: number; costUsd: number }

export function buildDaily(daily: TmxDailyInput[]): TmxDaily[] {
  return daily
    .map((d) => ({
      date: d.date,
      codexTokens: Math.max(0, d.codexTokens),
      claudeTokens: Math.max(0, d.claudeTokens),
      totalTokens: Math.max(0, d.codexTokens) + Math.max(0, d.claudeTokens),
      costUsd: Math.max(0, d.costUsd ?? 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Short brand domain (302-redirects to the serving host, path-preserving).
export const TMX_PROFILE_BASE_URL = 'https://tokmax.dev'
export const FABLE5_LEADERBOARD_START = '2026-07-01'
export const FABLE5_LEADERBOARD_END = '2026-07-07'
// The event runs on SAN FRANCISCO time (owner decision, 2026-07-02), but data
// days are the CLI's log date strings — UTC. July 7 in SF ends at 07:00 UTC on
// July 8, and days are the atom (can't be split), so the data window includes
// UTC 2026-07-08 in full. Display copy stays "July 1-7 · San Francisco time".
export const FABLE5_LEADERBOARD_DATA_END = '2026-07-08'

export function tmxProfileUrl(nick: string): string {
  return `${TMX_PROFILE_BASE_URL}/${nick}`
}

export function dateInFable5LeaderboardWindow(date: string): boolean {
  return date >= FABLE5_LEADERBOARD_START && date <= FABLE5_LEADERBOARD_DATA_END
}

// Window-scoped plausibility cap for the launch board. The all-time
// TMX_VALUE_CAP_USD gate would hide real whales (lifetime > $15k) from the
// event board even when their July window is modest — so the event board gets
// its own ceiling: ~7 days × $1k/day of extreme-but-physical usage. Above it →
// fable5Suspicious → hidden pending manual review.
export const FABLE5_WINDOW_VALUE_CAP_USD = 7_500

export function isFable5ModelId(model: string): boolean {
  const id = String(model || '')
    .toLowerCase()
    .replace(/[\s_:./@]+/g, '-')
  // Token-boundary match instead of a prefix match so provider-prefixed ids
  // also count: Bedrock `anthropic.claude-fable-5-*`, Vertex
  // `claude-fable-5@20260615`, router ids like `anthropic/claude-fable-5`.
  return /(^|-)(claude-)?fable-5(-|$)/.test(id)
}
