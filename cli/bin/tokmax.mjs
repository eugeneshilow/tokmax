#!/usr/bin/env node
//
// tokmax — scan local Codex + Claude Code logs, aggregate per-model token
// usage, preview the API-equivalent $, and publish the aggregate to the
// tokmax leaderboard (tokmax.dev).
//
// Ways to run:
//   npx tokmax            → interactive onboarding (Quick anonymous OR Sign in with X)
//   npx tokmax <nick>     → fast direct anonymous path (no prompts)
//   npx tokmax login      → Sign in with X (nick = your @handle, multi-machine)
//   npx tokmax logout     → sign out on this machine (logout --all = every machine)
//   npx tokmax publish    → non-interactive publish using the saved token (daily job)
//   npx tokmax daily ...   → on | off | status for the daily auto-update
//
// SAFETY INVARIANT: only numeric token aggregates per model + dates leave this
// machine. Never prompt text, file contents, API keys, or raw log lines.

import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { scanClaudeCode } from '../src/adapters/claude-code.mjs';
import { scanCodex } from '../src/adapters/codex.mjs';
import { aggregate } from '../src/aggregate.mjs';
import {
  aggregateSources,
  aggregateDailyCost,
  aggregateModelSpend,
  aggregateDailyModelSpend,
  buildRateMap,
  ATTRIBUTION,
} from '../src/pricing.mjs';
import { publish } from '../src/publish.mjs';
import { anonymousMachineLabel } from '../src/util.mjs';
import {
  loadSecret,
  saveSecret,
  loadAuth,
  deleteAuth,
  wipeLocal,
  loadPrefs,
  savePrefs,
} from '../src/secrets.mjs';
import { login, logout } from '../src/auth.mjs';
import { startProgress } from '../src/progress.mjs';
import { installDaily, removeDaily, dailyStatus } from '../src/daily.mjs';
import { detectSubscription } from '../src/plan.mjs';

const DEFAULT_API = 'https://gallant-wildcat-346.convex.site';
const PAGE_BASE = 'https://tokmax.dev'; // short brand domain (redirects to the serving host)
const REPO_URL = 'https://github.com/eugeneshilow/tokmax';
const REPO_DISPLAY = 'github.com/eugeneshilow/tokmax';
const FABLE5_LEADERBOARD_START = '2026-07-01';
const FABLE5_LEADERBOARD_END = '2026-07-07';
// Event runs on San Francisco time; log dates are UTC strings, so the data
// window includes UTC 2026-07-08 to cover July 7 in SF (matches the server).
const FABLE5_LEADERBOARD_DATA_END = '2026-07-08';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Open a URL in the default browser (best-effort; silent if unavailable).
// Hard sanitizer: only ever hand the OS a vetted https URL on OUR own domain —
// never arbitrary or server-controlled input. Closes CodeQL js/command-line-injection.
function openUrl(url) {
  let safe;
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:' || u.hostname !== new URL(PAGE_BASE).hostname) return false;
    safe = u.href;
  } catch {
    return false;
  }
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', safe] : [safe];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = {
    nick: null,
    since: null,
    key: null,
    api: DEFAULT_API,
    machine: anonymousMachineLabel(),
    sources: null, // null = both; { claude, codex }
    subscriptionUsd: null,
    dryRun: false,
    yes: false,
    onboard: false,
    help: false,
    bearer: null, // "Sign in with X" account token (set in main if logged in)
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--since':
        opts.since = argv[++i];
        break;
      case '--key':
        opts.key = argv[++i];
        break;
      case '--api':
        opts.api = argv[++i];
        break;
      case '--machine':
        opts.machine = argv[++i];
        break;
      case '--subscriptionUsd':
      case '--sub': {
        const v = Number((argv[++i] || '').replace(/[^0-9.]/g, ''));
        if (Number.isFinite(v) && v > 0) opts.subscriptionUsd = v;
        break;
      }
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--onboard':
        opts.onboard = true;
        break;
      case '--yes':
      case '-y':
        opts.yes = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        if (a && a.startsWith('-')) {
          console.error(`Unknown flag: ${a}`);
          process.exit(2);
        }
        rest.push(a);
    }
  }
  if (!opts.nick && rest.length) opts.nick = rest[0];
  if (opts.api) opts.api = opts.api.replace(/\/+$/, '');
  return opts;
}

const HELP = `tokmax — your public API-equivalent token meter

Run:
  npx tokmax            interactive onboarding (Quick anonymous OR Sign in with X)
  npx tokmax <nick>     fast direct anonymous path (no prompts)
  npx tokmax login      Sign in with X — your nick = your @handle (multi-machine)
  npx tokmax logout     sign out on this machine (logout --all = every machine)
  npx tokmax delete     permanently delete your page + account (sign in with X first)
  npx tokmax update     refresh your page with current numbers right now
  npx tokmax publish    same as update, non-interactive (used by the daily job)
  npx tokmax daily on   set up the daily auto-update
  npx tokmax daily off  remove the daily auto-update
  npx tokmax daily status   show the daily auto-update state

Options:
  --since YYYY-MM-DD   count only from this day (default: whole history)
  --key <secret>       capability token to update an already-claimed nick
  --api <baseUrl>      API base URL (default: tokenmax deployment)
  --machine <label>    machine label (default: anonymized machine-<hash>, never your raw hostname)
  --onboard            force the onboarding flow
  --dry-run            print the preview + request body, publish nothing
  --yes, -y            skip the confirmation prompt
  --help, -h           show this help`;

function fmtUsd(n) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n) {
  return n.toLocaleString('en-US');
}

function isFable5ModelId(model) {
  const id = String(model || '')
    .toLowerCase()
    .replace(/[\s_:.]+/g, '-');
  for (const prefix of ['claude-fable-5', 'fable-5']) {
    if (
      id === prefix ||
      id.startsWith(`${prefix}-`)
    ) {
      return true;
    }
  }
  return false;
}

function dateInFable5LeaderboardWindow(date) {
  return date >= FABLE5_LEADERBOARD_START && date <= FABLE5_LEADERBOARD_DATA_END;
}

// Stack Math — the launch week's second job: decide whether stacking one more
// subscription pays for itself. Marginal price of one more Claude Max 20×:
const MARGINAL_MAX_USD_PER_MO = 200;
const FABLE5_EVENT_TZ = 'America/Los_Angeles';

/** Extrapolate the window pace (day counter runs on San Francisco time, matching the site). */
function fable5StackMath(windowBurnUsd) {
  if (!(windowBurnUsd > 0)) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: FABLE5_EVENT_TZ }).format(new Date());
  if (today < FABLE5_LEADERBOARD_START) return null;
  const over = today > FABLE5_LEADERBOARD_END;
  const day = Math.min(
    7,
    Math.max(
      1,
      Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${FABLE5_LEADERBOARD_START}T00:00:00Z`)) /
          86400000,
      ) + 1,
    ),
  );
  const dailyRate = windowBurnUsd / (over ? 7 : day);
  return {
    weeklyRateUsd: dailyRate * 7,
    monthlyRateUsd: dailyRate * 30,
    secondSubMultiple: (dailyRate * 30) / MARGINAL_MAX_USD_PER_MO,
  };
}

async function readPackageVersion() {
  try {
    const pkg = JSON.parse(
      await readFile(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readAllStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

// confirm: Enter alone returns `defaultYes` (so the user can just press Enter to
// proceed). Explicit y/yes → true; anything else → false.
function confirm(question, { defaultYes = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      const a = answer.trim();
      if (a === '') return resolve(defaultYes);
      resolve(/^(y(es)?)$/i.test(a));
    });
  });
}

// One-line free prompt (returns the trimmed answer). Used for the subscription picker.
function promptLine(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

// "auto" start day: the beginning of the window that holds ~85% of total tokens —
// trims a thin, slow early tail (the "slacking" stretch) while keeping the real run.
// daily entries are sorted ascending and have totalTokens.
function autoSince(daily) {
  if (!Array.isArray(daily) || daily.length < 8) return null;
  const total = daily.reduce((s, d) => s + (d.totalTokens || 0), 0);
  if (total <= 0) return null;
  let acc = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    acc += daily[i].totalTokens || 0;
    if (acc >= total * 0.85) return daily[i].date;
  }
  return daily[0].date;
}

function validateNick(raw) {
  const nick = String(raw || '').trim();
  if (!nick) return { ok: false, msg: 'empty nick' };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/.test(nick)) {
    return {
      ok: false,
      msg: 'letters/digits/dash/underscore only, 2–32 chars, must start with a letter or digit',
    };
  }
  return { ok: true, nick };
}

async function checkAvailability(nick) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${PAGE_BASE}/${encodeURIComponent(nick)}`, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.status === 200) return 'taken';
    if (res.status === 404) return 'free';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Acknowledge a returning account before publishing: if the @handle already has
// a published page, say so + that THIS machine is being added (multi-device
// merge). Otherwise it's a fresh page. Uses the public page check — no extra
// backend call, no secrets.
async function acknowledgeAccount(handle) {
  if (!handle) return;
  const exists = (await checkAvailability(handle.toLowerCase())) === 'taken';
  if (exists) {
    console.log(
      `\n👋 Welcome back — @${handle} is already on tokmax. Adding THIS machine to your account; all your machines merge into one combined total.`,
    );
  } else {
    console.log(`\nSetting up your tokmax page for @${handle} — this is your first machine.`);
  }
}

// ── Onboarding ──────────────────────────────────────────────────────────────

/**
 * Interactive onboarding. First a clear choice — Quick (anonymous) or Sign in
 * with X — then a "how to count" step. For the X path it runs the real login()
 * flow and returns the bearer token + handle.
 *
 * @returns {Promise<null | {
 *   mode:'quick'|'x', nick:string|null, since:string|null,
 *   sources:{claude:boolean,codex:boolean}, subscriptionUsd:number|null,
 *   bearer?:string, handle?:string
 * }>}
 */
async function runOnboarding(cliVersion, apiBase) {
  // Adaptive input: real terminal → readline; piped (testing/scripting) →
  // pre-buffered lines (readline closes on a piped stream's EOF mid-flow).
  const isTty = Boolean(process.stdin.isTTY);
  const rl = isTty
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const buffered = isTty ? [] : (await readAllStdin()).split('\n');
  let bi = 0;
  const ask = (q) => {
    if (isTty) return new Promise((r) => rl.question(q, r));
    process.stdout.write(q);
    const ans = buffered[bi++] ?? '';
    process.stdout.write(`${ans}\n`);
    return Promise.resolve(ans);
  };

  const config = {
    mode: 'quick',
    nick: null,
    since: null,
    sources: { claude: true, codex: true },
    subscriptionUsd: null,
    bearer: undefined,
    handle: undefined,
  };

  try {
    console.log(`\n  tokmax v${cliVersion} — your public token meter`);
    console.log(`  open source: ${REPO_DISPLAY}`);
    console.log(`  We'll build your page at ${PAGE_BASE.replace('https://', '')}/<nick>.\n`);

    // ── Choice: Sign in with X (default) vs Quick (anonymous) ──
    console.log('How do you want to publish?');
    console.log('  [1] Sign in with X    — your @handle becomes your page name (identity, multi-machine, daily auto-update)  (recommended)');
    console.log('  [2] Quick (anonymous) — just pick a nick and publish');
    const choice = (await ask('  choice [1/2, Enter=1]: ')).trim();

    if (choice !== '2') {
      // Sign in with X — run the real login flow. rl must be released first so
      // the loopback prompts/output do not fight the readline interface.
      if (rl) rl.close();
      console.log('');
      try {
        const { handle } = await login(apiBase);
        config.mode = 'x';
        config.bearer = (await loadAuth())?.token;
        config.handle = handle || null;
        config.nick = handle || null;
        console.log(`\n✓ Signed in as @${handle || '?'} — your page name is your @handle.`);
        await acknowledgeAccount(handle);
      } catch (err) {
        console.error(`Sign-in failed: ${err && err.message ? err.message : err}`);
        return null;
      }
      // No further nick step; X path uses default counting (whole history, both
      // sources). Advanced tuning stays available via flags.
      return config;
    }

    // ── Quick (anonymous): pick a nick ──
    config.mode = 'quick';
    for (;;) {
      const raw = await ask('Pick a nick: ');
      const v = validateNick(raw);
      if (!v.ok) {
        console.log(`  ✗ ${v.msg}\n`);
        continue;
      }
      const checkP = startProgress(`Checking availability of "${v.nick}"`);
      const avail = await checkAvailability(v.nick.toLowerCase());
      checkP.succeed(
        avail === 'taken'
          ? `"${v.nick}" is taken`
          : avail === 'free'
            ? `"${v.nick}" is free`
            : `Checked "${v.nick}"`,
      );
      if (avail === 'taken') {
        const a = await ask(
          `  "${v.nick}" is taken. [y] it's mine — update it · [Enter] choose another: `,
        );
        if (/^(y(es)?)$/i.test(a.trim())) {
          config.nick = v.nick;
          break;
        }
        console.log('');
        continue;
      }
      config.nick = v.nick;
      break;
    }

    // ── How to count? ──
    console.log('\nHow should we count?');
    console.log('  [1] Default — whole history, Codex + Claude Code  (recommended)');
    console.log('  [2] Customize — period, sources, subscription');
    const mode = (await ask('  choice [1/2, Enter=1]: ')).trim();

    if (mode === '2') {
      for (;;) {
        const s = (await ask('  period — from which date? (YYYY-MM-DD, Enter = whole history): ')).trim();
        if (!s) break;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          config.since = s;
          break;
        }
        console.log('  ✗ format is YYYY-MM-DD');
      }
      const src = (
        await ask('  sources — [Enter] both · [c] Claude Code only · [x] Codex only: ')
      )
        .trim()
        .toLowerCase();
      if (src === 'c') config.sources = { claude: true, codex: false };
      else if (src === 'x') config.sources = { claude: false, codex: true };
      const sub = (await ask('  how much do you pay for subscriptions per month, $? (Enter = skip): ')).trim();
      const n = Number(sub.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) config.subscriptionUsd = n;
    }
    console.log('');
  } finally {
    if (rl) rl.close();
  }
  return config;
}

// ── Subcommands ───────────────────────────────────────────────────────────────

function resolveApiBase(rawArgs) {
  const i = rawArgs.indexOf('--api');
  if (i >= 0 && rawArgs[i + 1]) return rawArgs[i + 1].replace(/\/+$/, '');
  return DEFAULT_API;
}

async function loginCmd(rawArgs, apiBase) {
  console.log('tokmax · Sign in with X');
  let handle, file;
  try {
    ({ handle, file } = await login(apiBase));
  } catch (err) {
    console.error(`Sign-in failed: ${err && err.message ? err.message : err}`);
    return 1;
  }
  console.log(`\n✓ Signed in as @${handle || '?'} — your page name is your @handle.`);
  console.log(`Token saved: ${file} (chmod 600).`);
  await acknowledgeAccount(handle);

  // Login alone isn't the goal — publish THIS machine right away so the page
  // appears, and any additional machine merges automatically under the same
  // @handle (no key to copy). This is what makes multi-machine "just work".
  const auth = await loadAuth();
  const opts = parseArgs(rawArgs.slice(1)); // drop the 'login' arg, keep any flags
  opts.bearer = auth?.token;
  opts.nick = handle || auth?.handle || 'me';
  opts.sources = opts.sources || { claude: true, codex: true };
  const cliVersion = await readPackageVersion();
  const interactive = Boolean(process.stdin.isTTY);
  console.log('\nNow publishing this machine…\n');
  const { code, published } = await runPipeline(opts, cliVersion, { interactive });
  if (published && interactive) await offerDaily();
  return code;
}

async function logoutCmd(rawArgs, apiBase) {
  const all = rawArgs.includes('--all');
  const auth = await loadAuth();
  if (!auth) {
    console.log('Not signed in — nothing to remove.');
    return 0;
  }
  await logout(apiBase, auth.token, all);
  if (all) {
    console.log(`Signed out${auth.handle ? ` (@${auth.handle})` : ''} on EVERY machine. All tokens revoked.`);
  } else {
    console.log(`Signed out${auth.handle ? ` (@${auth.handle})` : ''} on this machine. Local token removed.`);
  }
  return 0;
}

async function deleteCmd(rawArgs, apiBase) {
  const auth = await loadAuth();
  if (!auth) {
    console.log('Not signed in on this machine — nothing to delete here.');
    console.log('(Sign in with X for one-command delete: npx tokmax login)');
    return 0;
  }
  const who = auth.handle ? `@${auth.handle}` : 'your tokmax page';
  console.log(`\n⚠️  This permanently DELETES ${who} from tokmax:`);
  console.log('    • your public page + leaderboard entry');
  console.log("    • every machine's data under this account");
  console.log('    • your account and all saved logins');
  console.log('  This cannot be undone.');
  const ok = await confirm(`  Delete ${who}? [y/N] `); // destructive → default NO
  if (!ok) {
    console.log('  Cancelled — nothing was deleted.\n');
    return 0;
  }
  let json = null;
  let httpStatus = 0;
  try {
    const res = await fetch(`${apiBase}/api/tmx/delete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.token}` },
    });
    httpStatus = res.status;
    json = await res.json().catch(() => null);
  } catch (err) {
    console.error(`  Network error: ${err && err.message ? err.message : err}. Nothing was deleted.`);
    return 1;
  }
  if (httpStatus === 401) {
    // The token is no longer valid — most often the account was ALREADY
    // deleted from another machine (delete is account-wide). Nothing to
    // remove server-side; finish the job locally so a dead daily job doesn't
    // keep firing with a revoked token forever.
    await removeDaily().catch(() => {});
    const wiped = await wipeLocal().catch(() => []);
    console.log('\n  ✓ This sign-in is no longer valid — the account is already gone from the server');
    console.log('    (deleted from another machine, or the login was revoked).');
    console.log('    • this machine: daily auto-update removed');
    console.log(`    • this machine: local files wiped${wiped.length ? ` (${wiped.join(', ')})` : ''}`);
    console.log('  Nothing tokmax stored remains. Run `npx tokmax` anytime to start fresh.\n');
    return 0;
  }
  if (httpStatus !== 200 || !json || !json.ok) {
    console.error(`  Could not delete (HTTP ${httpStatus}). Your page was NOT removed.`);
    return 1;
  }
  // Server data is gone — now wipe EVERY local trace of tokmax from this machine:
  // the daily job (launchd/cron) + auth.json + all capability secrets + the daily log.
  await removeDaily().catch(() => {});
  const wiped = await wipeLocal().catch(() => []);
  console.log('\n  ✓ Deleted — no trace left.');
  console.log(`    • server: ${who} page + account + every login removed`);
  console.log('    • this machine: daily auto-update removed');
  console.log(`    • this machine: local files wiped${wiped.length ? ` (${wiped.join(', ')})` : ''}`);
  console.log('  Nothing tokmax stored remains. Run `npx tokmax` anytime to start fresh.\n');
  return 0;
}

async function dailyCmd(rawArgs) {
  const sub = (rawArgs[1] || '').toLowerCase();
  if (sub === 'on') {
    const auth = await loadAuth();
    if (!auth) {
      console.log('Daily auto-update needs a saved sign-in. Run `npx tokmax login` first.');
      return 1;
    }
    const res = await installDaily();
    if (!res.ok) {
      console.error(`Could not set up the daily auto-update: ${res.detail || 'unknown error'}`);
      return 1;
    }
    const at = `${String(res.time.hour).padStart(2, '0')}:${String(res.time.minute).padStart(2, '0')}`;
    console.log(`✓ Daily auto-update is on (${res.platform}). It runs every day around ${at}.`);
    console.log('  The job reads your saved token at runtime — the schedule never stores it.');
    return 0;
  }
  if (sub === 'off') {
    const res = await removeDaily();
    console.log(res.removed ? '✓ Daily auto-update removed.' : 'Daily auto-update was not set up.');
    return 0;
  }
  if (sub === 'status') {
    const s = await dailyStatus();
    console.log(`Daily auto-update (${s.platform}): ${s.installed ? 'installed' : 'not installed'}${
      s.installed ? (s.active ? ' · active' : ' · inactive') : ''
    }`);
    console.log(`  token file: ${s.authFile}`);
    console.log(`  log file:   ${s.logFile}`);
    return 0;
  }
  console.log('Usage: npx tokmax daily on | off | status');
  return 2;
}

// ── Core pipeline (scan → compute → publish) ──────────────────────────────────

/**
 * Run the full scan → compute → publish pipeline with progress bars.
 * @returns {Promise<{ code:number, published:boolean }>}
 */
async function runPipeline(opts, cliVersion, { interactive }) {
  const nick = (opts.nick || '').trim();
  const nickKey = nick.toLowerCase();

  console.log(`tokmax v${cliVersion} · open source: ${REPO_DISPLAY}`);
  console.log(`nick: ${nick}${opts.bearer ? ' (via X)' : ''}`);

  // Start-day curation persists so a chosen trim sticks across re-runs + the (non-interactive)
  // daily job. `--since all` resets to full history; a flag date is applied + persisted;
  // otherwise fall back to the saved pref.
  if (opts.since === 'all') {
    opts.since = null;
    await savePrefs({ since: null });
  } else if (!opts.since) {
    const prefs = await loadPrefs();
    if (prefs.since) opts.since = prefs.since;
  } else if (!opts.dryRun) {
    await savePrefs({ since: opts.since });
  }

  // Step counter — total adapts to the scenario (dry-run skips the publish step).
  // The tag is captured once per step so it shows on BOTH the running spinner and
  // the final ✓ line (a fast run would otherwise hide the number).
  const STEPS = opts.dryRun ? 2 : 3;
  let stepN = 0;
  const stepTag = () => `[${++stepN}/${STEPS}]`;

  // 1. Scan local logs (with progress).
  const sources = opts.sources || { claude: true, codex: true };
  const total = (sources.claude ? 1 : 0) + (sources.codex ? 1 : 0);
  if (!total) {
    console.error('No sources selected.');
    return { code: 1, published: false };
  }
  const scanTag = stepTag();
  const scanP = startProgress(`${scanTag} Scanning local Codex + Claude Code logs`);
  let done = 0;
  const tick = () => scanP.update((++done / total) * 100);
  const tasks = [];
  if (sources.claude)
    tasks.push(scanClaudeCode().then((r) => (tick(), { tool: 'claude', r })));
  if (sources.codex) tasks.push(scanCodex().then((r) => (tick(), { tool: 'codex', r })));
  let wrapped;
  try {
    wrapped = await Promise.all(tasks);
  } catch (err) {
    scanP.fail('Scanning failed');
    throw err;
  }
  const scanned = wrapped.map((w) => w.r);
  const scanSummary = wrapped
    .map((w) =>
      w.tool === 'claude'
        ? `Claude Code: ${w.r.sessionCount} sessions`
        : `Codex: ${w.r.sessionCount} sessions`,
    )
    .join(' · ');
  scanP.succeed(`${scanTag} Scanned local logs — ${scanSummary}`);

  // Start-day offer: let the user hide a slow early stretch (curation they WANT — not the
  // tedious kind). Interactive only, only when no start day is set yet. The chosen day is
  // PUBLISHED-from + persisted, so the trim sticks across re-runs + daily, and viewers
  // can't expand to the hidden part (it's simply never published).
  if (interactive && !opts.yes && !opts.since) {
    const aggAll = aggregate(scanned, {});
    const span = aggAll.daily || [];
    if (span.length > 7) {
      console.log(`\n📅 Your logs span ${aggAll.firstDay} → ${aggAll.lastDay}.`);
      console.log("   Start your page from? (hides slow early days — they won't be published)");
      console.log('   [Enter] all  ·  [a] auto (smart)  ·  [1] last 30d  ·  [2] last 90d  ·  [d] a date');
      const pick = (await promptLine('   choice: ')).toLowerCase();
      const lastMs = Date.parse(aggAll.lastDay);
      if (pick === 'a') {
        opts.since = autoSince(span);
        if (opts.since) console.log(`   → auto: from ${opts.since} (where your activity ramped up)`);
      } else if (pick === '1') {
        opts.since = new Date(lastMs - 29 * 86400000).toISOString().slice(0, 10);
      } else if (pick === '2') {
        opts.since = new Date(lastMs - 89 * 86400000).toISOString().slice(0, 10);
      } else if (pick === 'd') {
        const d = await promptLine('   from date (YYYY-MM-DD): ');
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) opts.since = d;
      }
      if (opts.since) {
        await savePrefs({ since: opts.since });
        console.log(`   ✓ Page starts from ${opts.since} (saved — re-runs + daily keep it).`);
      }
    }
  }

  // 2. Aggregate + compute the API-equivalent $ (with progress).
  const computeTag = stepTag();
  const computeP = startProgress(`${computeTag} Computing the API-equivalent`);
  computeP.update(20);
  const agg = aggregate(scanned, { since: opts.since });
  if (!agg.models.length || agg.totalTokens === 0) {
    computeP.fail('No tokens found in the logs (after filters) — nothing to publish');
    return { code: 1, published: false };
  }
  computeP.update(55);
  // Prices come from the bundled LiteLLM snapshot + our override map; the CLI
  // computes $ locally (offline) and CARRIES it in the publish payload.
  const rateMap = await buildRateMap();
  computeP.update(85);
  const { sources: costSources, totals } = aggregateSources(agg.models, rateMap);
  const modelSpend = aggregateModelSpend(agg.models, rateMap);
  const dailyModelSpend = aggregateDailyModelSpend(agg.dailyModels, rateMap);
  const usd = totals.costUsd;
  // Per-day costUsd (same formula as the period total) → attach to each
  // token-only daily[] entry so the server can rank by calendar period
  // (month/year leaderboards).
  const dailyCost = aggregateDailyCost(agg.dailyModels, rateMap);
  const daily = agg.daily.map((d) => ({ ...d, costUsd: dailyCost.get(d.date) ?? 0 }));
  computeP.update(100);
  computeP.succeed(`${computeTag} Computed API-equivalent: $${fmtUsd(usd)}`);

  console.log(
    `Period: ${agg.firstDay} → ${agg.lastDay}` +
      (opts.since ? ` · filtered from ${opts.since}` : ' (everything found)'),
  );
  console.log('Models:');
  for (const m of agg.models) {
    const tot = m.input + m.output + m.cacheCreate + m.cacheRead + m.reasoning;
    console.log(`  ${m.tool}/${m.model}: ${fmtInt(tot)} tokens`);
  }
  console.log(`Total tokens: ${fmtInt(agg.totalTokens)}`);
  console.log(`API-equivalent: $${fmtUsd(usd)}`);
  const fable5Launch = dailyModelSpend
    .filter((day) => dateInFable5LeaderboardWindow(day.date))
    .flatMap((day) => day.models)
    .filter((m) => isFable5ModelId(m.model));
  if (fable5Launch.length) {
    const fable5Usd = fable5Launch.reduce((sum, m) => sum + m.costUsd, 0);
    const fable5Tokens = fable5Launch.reduce((sum, m) => sum + m.totalTokens, 0);
    console.log(
      `Fable 5 launch board (${FABLE5_LEADERBOARD_START} → ${FABLE5_LEADERBOARD_END}): $${fmtUsd(fable5Usd)} · ${fmtInt(fable5Tokens)} tokens`,
    );
    // Stack Math — the event's second job: should you stack another sub?
    // Pace understates real demand when you're capped; that caveat prints
    // WITH the number, never silently baked into it. Decision aid, not advice.
    const stack = fable5StackMath(fable5Usd);
    if (stack) {
      console.log(
        `⚖️  Stack math: ~$${fmtUsd(stack.weeklyRateUsd)}/wk pace → a 2nd Max ($${MARGINAL_MAX_USD_PER_MO}/mo) pays back ~${stack.secondSubMultiple.toFixed(1)}× if you're capped → ${PAGE_BASE}/fable-5`,
      );
    }
  }
  console.log(ATTRIBUTION);

  // and map it to retail $/mo; tokens are never read out or sent. `--sub <usd>` overrides.
  if (!opts.subscriptionUsd) {
    const det = await detectSubscription();
    if (det) {
      opts.subscriptionUsd = det.totalUsd;
      console.log(`\n💸 Detected your plan locally: ${det.label} = $${det.totalUsd}/mo — we'll show how many × you beat it.`);
      console.log('   (only the plan label + $ are sent, never your tokens · wrong? re-run with --sub <usd>)');
    }
  }

  // PROFIT/× = ROLLING LAST 30 DAYS vs one month of the plan (matches the page). Stable
  // (no calendar month-start dip), apples-to-apples; no purchase date / historical guessing.
  // Kept in scope: the post-publish share text reuses it.
  let econ = null;
  if (opts.subscriptionUsd && daily.length) {
    const lastDate = daily[daily.length - 1].date;
    const windowStart = new Date(Date.parse(lastDate) - 29 * 86400000).toISOString().slice(0, 10);
    const windowBurn = daily
      .filter((d) => d.date >= windowStart)
      .reduce((s, d) => s + (d.costUsd || 0), 0);
    const ratio = opts.subscriptionUsd > 0 ? windowBurn / opts.subscriptionUsd : 0;
    econ = { windowBurn, ratio, profit: windowBurn - opts.subscriptionUsd };
    console.log(
      `Last 30 days: $${fmtUsd(windowBurn)} of API value on your $${fmtUsd(opts.subscriptionUsd)}/mo plan → ${ratio.toFixed(1)}× (profit $${fmtUsd(windowBurn - opts.subscriptionUsd)})`,
    );
  }

  console.log('Only the aggregate numbers are sent — your logs and keys stay on this machine.');

  const body = {
    nick,
    cliVersion,
    pricingVersion: rateMap.version,
    firstDay: agg.firstDay,
    lastDay: agg.lastDay,
    machineLabel: opts.machine,
    models: agg.models,
    modelSpend,
    dailyModelSpend,
    sources: costSources,
    totals,
    daily,
    ...(opts.subscriptionUsd ? { subscriptionUsd: opts.subscriptionUsd } : {}),
  };

  if (opts.dryRun) {
    console.log('\n--dry-run: request body that would have been sent:');
    console.log(JSON.stringify(body, null, 2));
    console.log('\n(nothing published)');
    return { code: 0, published: false };
  }

  // "Sign in with X": the account token (bearer) authorizes the publish and the
  // server uses the X handle as the nick. Otherwise fall back to the legacy
  // capability token (explicit --key wins, else a saved secret for this nick).
  if (!opts.bearer) {
    const savedSecret = await loadSecret(nickKey);
    const secret = opts.key || savedSecret;
    if (secret) body.secret = secret;
  }

  if (interactive && !opts.yes) {
    const who = opts.bearer ? `@${nick}` : nick;
    const ok = await confirm(`Publish your tokmax page as ${who}? [Y/n] `, { defaultYes: true });
    if (!ok) {
      console.log('Cancelled.');
      return { code: 0, published: false };
    }
  }

  const pubTag = stepTag();
  const pubP = startProgress(`${pubTag} Publishing your tokmax page as ${opts.bearer ? `@${nick}` : nick}`);
  const { status, json } = await publish(opts.api, body, opts.bearer);

  if (!json) {
    pubP.fail(`Unexpected server response: HTTP ${status}`);
    return { code: 1, published: false };
  }

  if (json.ok) {
    pubP.succeed(`${pubTag} Published`);
    if (opts.bearer) {
      console.log(`\nPublished to your tokmax page as @${json.nick || nick}.`);
    } else if (json.created && json.secret) {
      const file = await saveSecret(nickKey, {
        nick: json.nick || nickKey,
        secret: json.secret,
        url: json.url,
        createdAt: Date.now(),
      });
      console.log(`\nSaved your capability token: ${file} (chmod 600)`);
      console.log("Keep it — it's required to update this nick later.");
    } else {
      console.log('\nUpdated your existing profile.');
    }
    console.log(`costUsd: $${fmtUsd(json.costUsd)} · tokens: ${fmtInt(json.totalTokens)}`);
    if (json.suspicious) {
      console.log('⚠️  The server flagged this submission as suspicious (manual review).');
    }
    console.log(`\n  Done! Your page: ${json.url}\n`);

    // Auto-open the published page so any machine lands straight on the result.
    const pageUrl = `${PAGE_BASE}/${encodeURIComponent(json.nick || nick)}`;
    if (interactive && openUrl(pageUrl)) {
      console.log('  Opening it in your browser…\n');
    }

    // Share moment: a paste-ready post with the numbers + a one-click X intent
    // link. The paste/screenshot IS the viral loop — make it zero-effort.
    const fable5ShareUsd = fable5Launch.reduce((sum, m) => sum + m.costUsd, 0);
    const shareLines = [
      `I burned $${fmtUsd(usd)} in AI tokens at API prices` +
        (econ && econ.profit >= 0
          ? ` — ${econ.ratio.toFixed(1)}× my $${fmtUsd(opts.subscriptionUsd)}/mo plan`
          : '') +
        '.',
      ...(fable5ShareUsd > 0
        ? [`Fable 5 launch week: $${fmtUsd(fable5ShareUsd)} → ${PAGE_BASE}/fable-5`]
        : []),
      'See yours: npx tokmax',
      pageUrl,
    ];
    console.log('  ── Share it — paste-ready ──');
    for (const line of shareLines) console.log(`  │ ${line}`);
    console.log(
      `  → post it: https://x.com/intent/post?text=${encodeURIComponent(shareLines.join('\n'))}\n`,
    );

    console.log('  ── Add another computer / server (your dashboard sums them all) ──');
    if (opts.bearer) {
      console.log('  On the other machine, just run one command:');
      console.log('    npx tokmax login      ← sign in with the SAME X account');
      console.log(`  It signs in, publishes that machine, and merges into ${json.url} automatically.\n`);
    } else {
      console.log('  On the other machine, run (same nick + your capability token):');
      console.log(`    npx tokmax ${json.nick || nick} --key <your-token>`);
      console.log(`  Your token is saved on THIS machine at ~/.config/tokenmax/${json.nick || nick}.json`);
      console.log(`  Both machines then sum into ${json.url}.`);
      console.log('  Tip: "Sign in with X" is simpler — then any machine just needs the same login, no token.\n');
    }
    return { code: 0, published: true };
  }

  // Documented error reasons.
  pubP.fail('Publish failed');
  switch (json.reason) {
    case 'nick_taken':
      console.error(`Nick taken: ${json.message || nick}`);
      if (json.suggestion) console.error(`Try: ${json.suggestion}`);
      console.error('If this nick is yours, update it with --key <secret> (capability token).');
      return { code: 1, published: false };
    case 'rate_limited':
      console.error(`Too frequent: ${json.message || 'rate limited'}`);
      return { code: 1, published: false };
    case 'nick_invalid':
      console.error(`Invalid nick: ${json.message || nick}`);
      return { code: 1, published: false };
    case 'empty_usage':
      console.error('Server: empty aggregate (empty_usage).');
      return { code: 1, published: false };
    case 'invalid_payload':
      console.error(`Invalid request body: ${json.message || ''}`);
      return { code: 1, published: false };
    case 'unauthorized':
      console.error('Your X token is invalid or revoked. Sign in again: npx tokmax login');
      return { code: 1, published: false };
    default:
      console.error(`Publish error (HTTP ${status}): ${JSON.stringify(json)}`);
      return { code: 1, published: false };
  }
}

/** Offer the daily auto-update after a successful interactive publish. */
async function offerDaily() {
  const status = await dailyStatus();
  if (status.installed) return;
  // Explain the mechanism BEFORE asking (request: be clear how it works + that
  // it changes nothing about the security boundary).
  console.log('\nKeep your number fresh automatically?');
  console.log('  How it works: while THIS machine is on, a scheduled job (launchd on macOS,');
  console.log('  cron on Linux) runs once a day. It re-runs the same publish locally — reads your');
  console.log('  saved sign-in token (~/.config/tokenmax/auth.json, chmod 600, never leaves the');
  console.log('  machine), recomputes your aggregate, and sends only the numbers. Same data');
  console.log('  boundary as right now; the schedule never stores your token, nothing new is sent.');
  const yes = await confirm('  Set it up? [Y/n] ', { defaultYes: true });
  if (!yes) {
    console.log('  Skipped — nothing scheduled. Turn it on later: npx tokmax daily on\n');
    return;
  }
  const res = await installDaily();
  if (!res.ok) {
    console.error(`  Could not set up the daily auto-update: ${res.detail || 'unknown error'}`);
    return;
  }
  const at = `${String(res.time.hour).padStart(2, '0')}:${String(res.time.minute).padStart(2, '0')}`;
  // Tell the user EXACTLY what was set up + how to turn it off.
  console.log(`\n  ✓ Done — set up on ${res.platform}:`);
  console.log(`    • runs once a day around ${at}, only while this machine is on`);
  console.log('    • re-runs `npx tokmax publish` locally with your saved token; sends only aggregates');
  console.log('  Turn it OFF any time:');
  console.log('    • this machine:  npx tokmax daily off');
  console.log('    • check status:  npx tokmax daily status\n');
}

// ── Non-interactive publish (used by the daily job) ───────────────────────────

async function publishCmd(rawArgs) {
  const opts = parseArgs(rawArgs);
  const cliVersion = await readPackageVersion();
  // The daily run MUST have a saved token; otherwise skip + log (don't fail).
  const auth = await loadAuth();
  if (!auth) {
    console.error(
      '[tokmax daily] No saved auth token (~/.config/tokenmax/auth.json) — run `npx tokmax login` first. Skipping this run.',
    );
    return 0;
  }
  opts.bearer = auth.token;
  opts.nick = auth.handle || 'me';
  opts.yes = true;
  opts.sources = opts.sources || { claude: true, codex: true };
  const { code } = await runPipeline(opts, cliVersion, { interactive: false });
  return code;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2);

  // Subcommands are intercepted before nick parsing (else "login" would be read
  // as a nick).
  if (rawArgs[0] === 'login') return loginCmd(rawArgs, resolveApiBase(rawArgs));
  if (rawArgs[0] === 'logout') return logoutCmd(rawArgs, resolveApiBase(rawArgs));
  if (rawArgs[0] === 'delete') return deleteCmd(rawArgs, resolveApiBase(rawArgs));
  if (rawArgs[0] === 'daily') return dailyCmd(rawArgs);
  // `update` = the human-facing alias of `publish`: refresh the page with
  // current numbers right now (publish stays — the daily job uses it).
  if (rawArgs[0] === 'publish' || rawArgs[0] === 'update') return publishCmd(rawArgs.slice(1));

  const opts = parseArgs(rawArgs);

  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const cliVersion = await readPackageVersion();

  // "Sign in with X": if already logged in, publish under the X handle (bearer).
  // First-run `npx tokmax` WITHOUT login keeps the legacy nick+capability path.
  const auth = await loadAuth();
  if (auth) {
    opts.bearer = auth.token;
    if (!opts.nick) opts.nick = auth.handle || null;
  }

  // No nick + interactive terminal (or --onboard) → run the onboarding. When
  // already signed in we skip onboarding (the handle is the nick).
  if (!opts.bearer && (opts.onboard || (!opts.nick && process.stdin.isTTY))) {
    const cfg = await runOnboarding(cliVersion, opts.api);
    if (!cfg || !cfg.nick) {
      console.error('Onboarding cancelled.');
      return 1;
    }
    opts.nick = cfg.nick;
    opts.since = cfg.since;
    opts.sources = cfg.sources;
    opts.subscriptionUsd = cfg.subscriptionUsd;
    if (cfg.mode === 'x' && cfg.bearer) opts.bearer = cfg.bearer;
  }

  if (!opts.nick) {
    console.error('Provide a nick: npx tokmax <nick>  (or run npx tokmax with no arguments)');
    return 2;
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
    console.error(`--since must be YYYY-MM-DD, got: ${opts.since}`);
    return 2;
  }

  const interactive = Boolean(process.stdin.isTTY);
  const { code, published } = await runPipeline(opts, cliVersion, { interactive });

  // Offer the daily auto-update after a successful publish — especially when
  // signed in (the daily job needs the saved token).
  if (published && interactive && opts.bearer) {
    await offerDaily();
  }

  return code;
}

main()
  .then((code) => process.exit(code || 0))
  .catch((err) => {
    console.error(`Failure: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  });
