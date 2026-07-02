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
