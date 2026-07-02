// Fable 5 launch-board clock. Owner decision (2026-07-02): the event runs on
// SAN FRANCISCO time — day counter and deadline are computed in
// America/Los_Angeles, not UTC. Data days stay the CLI's log date strings
// (UTC); the data window therefore includes UTC 2026-07-08 so July 7 in SF
// counts in full (see convex/lib/tmx.ts FABLE5_LEADERBOARD_DATA_END).

export const FABLE5_EVENT_TZ = 'America/Los_Angeles'
export const FABLE5_START = '2026-07-01'
export const FABLE5_END = '2026-07-07'

function tzToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FABLE5_EVENT_TZ }).format(new Date())
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)
}

export type Fable5Countdown = {
  day: number
  daysLeft: number
  started: boolean
  over: boolean
}

export function fable5Countdown(): Fable5Countdown {
  const today = tzToday()
  const day = Math.min(7, Math.max(1, dayDiff(today, FABLE5_START) + 1))
  const daysLeft = Math.max(0, dayDiff(FABLE5_END, today) + 1)
  return { day, daysLeft, started: today >= FABLE5_START, over: today > FABLE5_END }
}

export function fable5ChipLabel(): string {
  const c = fable5Countdown()
  if (c.over) return 'FABLE 5 · FINAL RESULTS'
  return `FABLE 5 · DAY ${c.day}/7 · ${c.daysLeft} DAY${c.daysLeft === 1 ? '' : 'S'} LEFT`
}

// ── Stack Math ──────────────────────────────────────────────────────────────
// The event's second job (owner decision, 2026-07-02): help people decide
// whether a SECOND (third, …) subscription pays for itself. Marginal price of
// stacking one more Claude Max 20×:
export const MARGINAL_MAX_USD_PER_MO = 200

export type Fable5StackMath = {
  daysElapsed: number
  weeklyRateUsd: number
  monthlyRateUsd: number
  secondSubMultiple: number
}

/**
 * Extrapolate the window pace. Honest framing matters: logs only show what
 * the 50% cap LET the user burn, so the pace UNDERSTATES real demand — that
 * is the pro-argument, printed next to the number, never silently baked in.
 * This is a decision aid on API-equivalent value, not financial advice.
 */
export function fable5StackMath(windowBurnUsd: number): Fable5StackMath | null {
  const c = fable5Countdown()
  if (!c.started || windowBurnUsd <= 0) return null
  const daysElapsed = Math.max(1, c.over ? 7 : c.day)
  const dailyRate = windowBurnUsd / daysElapsed
  const weeklyRateUsd = dailyRate * 7
  const monthlyRateUsd = dailyRate * 30
  return {
    daysElapsed,
    weeklyRateUsd,
    monthlyRateUsd,
    secondSubMultiple: monthlyRateUsd / MARGINAL_MAX_USD_PER_MO,
  }
}
