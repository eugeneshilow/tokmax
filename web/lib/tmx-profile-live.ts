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
  totals: TmxProfileTotals
  costUsd: number
  totalTokens: number
  submissionCount: number
  cliVersion: string
  suspicious: boolean
  subscriptionUsd?: number
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
}

// Period leaderboard row = leaderboard row + explicit period cost. costUsd is
// the PERIOD cost (the rank value); periodCostUsd mirrors it by an explicit name.
export type TmxPeriodLeaderboardRow = TmxLeaderboardRow & {
  periodCostUsd: number
}

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
