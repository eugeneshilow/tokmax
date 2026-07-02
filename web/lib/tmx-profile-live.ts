import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

export type TmxProfileSource = {
  source: string
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxProfileModelSpend = {
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

export type TmxProfileDaily = {
  date: string
  codexTokens: number
  claudeTokens: number
  totalTokens: number
  costUsd?: number
}

export type TmxProfileTotals = {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
  reasoning: number
  totalTokens: number
  costUsd: number
}

export type TmxProfile = {
  nick: string
  firstDay: string
  lastDay: string
  machineLabels: string[]
  sources: TmxProfileSource[]
  daily: TmxProfileDaily[]
  modelSpend: TmxProfileModelSpend[]
  totals: TmxProfileTotals
  costUsd: number
  totalTokens: number
  fable5CostUsd: number
  fable5Tokens: number
  fable5LaunchCostUsd: number
  fable5LaunchTokens: number
  submissionCount: number
  cliVersion: string
  suspicious: boolean
  subscriptionUsd?: number
  avatar_url?: string | null
  verified?: boolean
  firstSeenAt: number
  updatedAt: number
}

export type TmxLeaderboardRow = {
  nick: string
  costUsd: number
  totalTokens: number
  lastDay: string
  machineLabels: string[]
  updatedAt: number
  avatar_url?: string | null
  verified?: boolean
}

// Period leaderboard row = leaderboard row + explicit period cost. costUsd is
// the PERIOD cost (the rank value); periodCostUsd mirrors it by an explicit name.
export type TmxPeriodLeaderboardRow = TmxLeaderboardRow & {
  periodCostUsd: number
}

export type TmxFable5LeaderboardRow = TmxLeaderboardRow & {
  fable5CostUsd: number
  fable5Tokens: number
  fable5LaunchCostUsd: number
  fable5LaunchTokens: number
  allCostUsd: number
  allTotalTokens: number
}

export const FABLE5_LEADERBOARD_START = '2026-07-01'
export const FABLE5_LEADERBOARD_END = '2026-07-07'
export const FABLE5_LEADERBOARD_LABEL = 'July 1-7, 2026'

const getTmxProfileByNick = makeFunctionReference<'query', { nick: string }, TmxProfile | null>(
  'tables/data_cooked_tmx_profiles:getByNick'
)

const listTmxLeaderboard = makeFunctionReference<'query', { limit?: number }, TmxLeaderboardRow[]>(
  'tables/data_cooked_tmx_profiles:listLeaderboard'
)

const listTmxLeaderboardByPeriod = makeFunctionReference<
  'query',
  { period: string; limit?: number },
  TmxPeriodLeaderboardRow[]
>('tables/data_cooked_tmx_profiles:listLeaderboardByPeriod')

const listTmxFable5Leaderboard = makeFunctionReference<
  'query',
  { limit?: number },
  TmxFable5LeaderboardRow[]
>('tables/data_cooked_tmx_profiles:listFable5Leaderboard')

export async function loadTmxProfile(nick: string): Promise<TmxProfile | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  try {
    const convex = new ConvexHttpClient(convexUrl)
    return await convex.query(getTmxProfileByNick, { nick })
  } catch (error) {
    console.warn('tmx profile unavailable', error)
    return null
  }
}

export async function loadTmxLeaderboard(limit?: number): Promise<TmxLeaderboardRow[]> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return []

  try {
    const convex = new ConvexHttpClient(convexUrl)
    return await convex.query(listTmxLeaderboard, limit === undefined ? {} : { limit })
  } catch (error) {
    console.warn('tmx leaderboard unavailable', error)
    return []
  }
}

/**
 * Period leaderboard: period = "all" | "YYYY" (year) | "YYYY-MM" (month).
 * Ranks accounts by the sum of per-day cost falling in that calendar period.
 */
export async function loadTmxLeaderboardByPeriod(
  period: string,
  limit?: number
): Promise<TmxPeriodLeaderboardRow[]> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return []

  try {
    const convex = new ConvexHttpClient(convexUrl)
    return await convex.query(
      listTmxLeaderboardByPeriod,
      limit === undefined ? { period } : { period, limit }
    )
  } catch (error) {
    console.warn('tmx period leaderboard unavailable', error)
    return []
  }
}

export async function loadTmxFable5Leaderboard(limit?: number): Promise<TmxFable5LeaderboardRow[]> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return []

  try {
    const convex = new ConvexHttpClient(convexUrl)
    return await convex.query(listTmxFable5Leaderboard, limit === undefined ? {} : { limit })
  } catch (error) {
    console.warn('tmx fable 5 leaderboard unavailable', error)
    return []
  }
}
