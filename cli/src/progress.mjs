// Tiny dependency-free progress UI (spinner + [#####-----] bar), rendered to
// STDERR so piped stdout stays clean (e.g. `tokmax --dry-run | jq`).
//
// When stderr is not a TTY (CI, piped, launchd/cron logs) the live animation is
// suppressed; only the final one-line ✓/✗ summary is printed, without escape
// codes. No timers leak — succeed()/fail() always clear the interval.

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const CELLS = 22
const isTty = Boolean(process.stderr.isTTY)

function draw(line) {
  // \r → carriage return, \x1b[K → clear to end of line.
  process.stderr.write(`\r\x1b[K${line}`)
}

/**
 * Start a progress line.
 * @param {string} label
 * @returns {{ update(percent:number):void, succeed(msg?:string):void, fail(msg?:string):void }}
 */
export function startProgress(label) {
  let pct = 0
  let frame = 0
  let timer = null

  const paint = () => {
    const filled = Math.max(0, Math.min(CELLS, Math.round((pct / 100) * CELLS)))
    const bar = `[${'#'.repeat(filled)}${'-'.repeat(CELLS - filled)}]`
    draw(`${FRAMES[frame % FRAMES.length]} ${label} ${bar} ${Math.round(pct)}%`)
  }

  if (isTty) {
    paint()
    timer = setInterval(() => {
      frame += 1
      paint()
    }, 90)
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    update(percent) {
      pct = Math.max(0, Math.min(100, Number(percent) || 0))
      if (isTty) paint()
    },
    succeed(msg) {
      stop()
      const text = msg ?? label
      // TTY: clear the live line first; piped: plain text, no escape codes.
      process.stderr.write(`${isTty ? '\r\x1b[K' : ''}✓ ${text}\n`)
    },
    fail(msg) {
      stop()
      const text = msg ?? label
      process.stderr.write(`${isTty ? '\r\x1b[K' : ''}✗ ${text}\n`)
    },
  }
}

/** Run an async task under a labelled progress line; auto succeed/fail. */
export async function withProgress(label, fn, { succeedMsg } = {}) {
  const p = startProgress(label)
  try {
    const result = await fn((percent) => p.update(percent))
    p.succeed(succeedMsg ?? label)
    return result
  } catch (err) {
    p.fail(`${label} — failed`)
    throw err
  }
}
