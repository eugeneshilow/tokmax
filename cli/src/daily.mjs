// Daily auto-update — install a per-platform scheduled job that runs a
// NON-INTERACTIVE `tokmax publish` once a day, keeping your number fresh on the
// leaderboard.
//
// SECURITY: the scheduled job NEVER contains the account token. It simply runs
// `tokmax publish`, which reads the saved token from ~/.config/tokenmax/auth.json
// at runtime. If no token is saved, the daily run skips and logs (see publish).
//
//   macOS   → launchd LaunchAgent plist (StartCalendarInterval)
//   Linux   → crontab line
//   Windows → schtasks /Create /SC DAILY

import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const LAUNCHD_LABEL = 'tech.vibecoding.tokmax.daily'
const CRON_MARKER = '# tokmax-daily'
const SCHTASKS_NAME = 'tokmax-daily'

function configDir() {
  return path.join(os.homedir(), '.config', 'tokenmax')
}
function authFilePath() {
  return path.join(configDir(), 'auth.json')
}
function logFilePath() {
  return path.join(configDir(), 'daily.log')
}
function plistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`)
}

/** Absolute path to this CLI's entrypoint (bin/tokmax.mjs). */
function cliEntry() {
  return path.join(__dirname, '..', 'bin', 'tokmax.mjs')
}

/** The argv the scheduler should run: `<node> <bin/tokmax.mjs> publish`. */
function publishCommand() {
  return { node: process.execPath, script: cliEntry(), args: ['publish'] }
}

/** Spread load: a stable-ish daily time chosen at install (09:00–20:59). */
function pickDailyTime() {
  const hour = 9 + Math.floor(Math.random() * 12)
  const minute = Math.floor(Math.random() * 60)
  return { hour, minute }
}

function run(cmd, args, { input } = {}) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: stdout || '', stderr: stderr || '' })
    })
    if (typeof input === 'string') {
      child.stdin.end(input)
    }
  })
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── macOS (launchd) ──────────────────────────────────────────────────────────

function buildPlist(time) {
  const { node, script, args } = publishCommand()
  const programArgs = [node, script, ...args]
    .map((a) => `    <string>${xmlEscape(a)}</string>`)
    .join('\n')
  const log = logFilePath()
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${programArgs}
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${time.hour}</integer>
    <key>Minute</key>
    <integer>${time.minute}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(log)}</string>
</dict>
</plist>
`
}

async function installLaunchd(time) {
  const file = plistPath()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, buildPlist(time), 'utf8')
  // Reload: unload any previous definition (ignore error), then load.
  await run('launchctl', ['unload', file])
  const loaded = await run('launchctl', ['load', file])
  if (loaded.code !== 0) {
    return { ok: false, detail: loaded.stderr.trim() || 'launchctl load failed' }
  }
  return { ok: true, file }
}

async function removeLaunchd() {
  const file = plistPath()
  if (await exists(file)) {
    await run('launchctl', ['unload', file])
    await rm(file, { force: true })
    return { ok: true, removed: true }
  }
  return { ok: true, removed: false }
}

async function statusLaunchd() {
  const file = plistPath()
  const installed = await exists(file)
  let active = false
  if (installed) {
    const list = await run('launchctl', ['list'])
    active = list.stdout.includes(LAUNCHD_LABEL)
  }
  return { installed, active, file }
}

// ── Linux (crontab) ──────────────────────────────────────────────────────────

function cronLine(time) {
  const { node, script, args } = publishCommand()
  const log = logFilePath()
  const cmd = [node, script, ...args].map((a) => JSON.stringify(a)).join(' ')
  return `${time.minute} ${time.hour} * * * ${cmd} >> ${JSON.stringify(log)} 2>&1 ${CRON_MARKER}`
}

async function readCrontab() {
  const res = await run('crontab', ['-l'])
  // No crontab yet → non-zero exit with empty content; treat as empty.
  return res.code === 0 ? res.stdout : ''
}

function stripMarker(crontab) {
  return crontab
    .split('\n')
    .filter((l) => !l.includes(CRON_MARKER))
    .join('\n')
    .replace(/\n+$/, '')
}

async function installCron(time) {
  const current = stripMarker(await readCrontab())
  const next = `${current ? current + '\n' : ''}${cronLine(time)}\n`
  const res = await run('crontab', ['-'], { input: next })
  if (res.code !== 0) {
    return { ok: false, detail: res.stderr.trim() || 'crontab write failed' }
  }
  return { ok: true }
}

async function removeCron() {
  const current = await readCrontab()
  if (!current.includes(CRON_MARKER)) return { ok: true, removed: false }
  const next = stripMarker(current)
  const res = await run('crontab', ['-'], { input: next ? next + '\n' : '' })
  return { ok: res.code === 0, removed: true }
}

async function statusCron() {
  const current = await readCrontab()
  const installed = current.includes(CRON_MARKER)
  return { installed, active: installed }
}

// ── Windows (schtasks) ───────────────────────────────────────────────────────

async function installSchtasks(time) {
  const { node, script, args } = publishCommand()
  const tr = `"${node}" "${script}" ${args.join(' ')}`
  const st = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
  const res = await run('schtasks', [
    '/Create',
    '/SC',
    'DAILY',
    '/TN',
    SCHTASKS_NAME,
    '/TR',
    tr,
    '/ST',
    st,
    '/F',
  ])
  if (res.code !== 0) {
    return { ok: false, detail: res.stderr.trim() || 'schtasks create failed' }
  }
  return { ok: true }
}

async function removeSchtasks() {
  const res = await run('schtasks', ['/Delete', '/TN', SCHTASKS_NAME, '/F'])
  return { ok: true, removed: res.code === 0 }
}

async function statusSchtasks() {
  const res = await run('schtasks', ['/Query', '/TN', SCHTASKS_NAME])
  const installed = res.code === 0
  return { installed, active: installed }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Install the daily job. Returns { ok, platform, time, detail? }. */
export async function installDaily() {
  const time = pickDailyTime()
  let res
  if (process.platform === 'darwin') res = await installLaunchd(time)
  else if (process.platform === 'win32') res = await installSchtasks(time)
  else res = await installCron(time)
  return { ...res, platform: process.platform, time }
}

/** Remove the daily job on any platform. */
export async function removeDaily() {
  if (process.platform === 'darwin') return { ...(await removeLaunchd()), platform: 'darwin' }
  if (process.platform === 'win32') return { ...(await removeSchtasks()), platform: 'win32' }
  return { ...(await removeCron()), platform: 'linux' }
}

/** Report whether the daily job is installed. */
export async function dailyStatus() {
  let s
  if (process.platform === 'darwin') s = await statusLaunchd()
  else if (process.platform === 'win32') s = await statusSchtasks()
  else s = await statusCron()
  return { ...s, platform: process.platform, authFile: authFilePath(), logFile: logFilePath() }
}
