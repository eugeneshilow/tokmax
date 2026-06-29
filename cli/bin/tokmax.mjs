#!/usr/bin/env node
//
// tokmax — scan local Codex + Claude Code logs, aggregate per-model token
// usage, preview the API-equivalent $, and publish the aggregate to the
// tokenmax leaderboard (tokmax.vibecoding.tech).
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

import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { scanClaudeCode } from '../src/adapters/claude-code.mjs';
import { scanCodex } from '../src/adapters/codex.mjs';
import { aggregate } from '../src/aggregate.mjs';
import { aggregateSources, aggregateDailyCost, buildRateMap, ATTRIBUTION } from '../src/pricing.mjs';
import { publish } from '../src/publish.mjs';
import { loadSecret, saveSecret, loadAuth } from '../src/secrets.mjs';
import { login, logout } from '../src/auth.mjs';
import { startProgress } from '../src/progress.mjs';
import { installDaily, removeDaily, dailyStatus } from '../src/daily.mjs';

const DEFAULT_API = 'https://chatty-boar-479.convex.site';
const PAGE_BASE = 'https://tokmax.vibecoding.tech'; // canonical served page (availability check)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    nick: null,
    since: null,
    key: null,
    api: DEFAULT_API,
    machine: os.hostname(),
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
  npx tokmax publish    non-interactive publish using the saved token (used by the daily job)
  npx tokmax daily on   set up the daily auto-update
  npx tokmax daily off  remove the daily auto-update
  npx tokmax daily status   show the daily auto-update state

Options:
  --since YYYY-MM-DD   count only from this day (default: whole history)
  --key <secret>       capability token to update an already-claimed nick
  --api <baseUrl>      API base URL (default: tokenmax deployment)
  --machine <label>    machine label (default: hostname)
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

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^(y(es)?)$/i.test(answer.trim()));
    });
  });
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
    console.log(`  We'll build your page at ${PAGE_BASE.replace('https://', '')}/<nick>.\n`);

    // ── Choice: Quick (anonymous) vs Sign in with X ──
    console.log('How do you want to publish?');
    console.log('  [1] Quick (anonymous) — pick a nick, compute, publish  (recommended)');
    console.log('  [2] Sign in with X    — publish under your @handle (identity, multi-machine, daily auto-update)');
    const choice = (await ask('  choice [1/2, Enter=1]: ')).trim();

    if (choice === '2') {
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
        console.log(`\n✓ Signed in as @${handle || '?'} — publishing under this X account.`);
        console.log('  Second machine with the same login merges automatically (no --key).\n');
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

async function loginCmd(apiBase) {
  console.log('tokmax · Sign in with X');
  try {
    const { handle, file } = await login(apiBase);
    console.log(`\n✓ Signed in as @${handle || '?'}`);
    console.log(`Token saved: ${file} (chmod 600).`);
    console.log(
      'Now `npx tokmax` publishes under this X account — a second machine with the same login merges automatically (no --key).',
    );
    return 0;
  } catch (err) {
    console.error(`Sign-in failed: ${err && err.message ? err.message : err}`);
    return 1;
  }
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

  console.log(`tokmax v${cliVersion} · nick: ${nick}${opts.bearer ? ' (via X)' : ''}`);

  // 1. Scan local logs (with progress).
  const sources = opts.sources || { claude: true, codex: true };
  const total = (sources.claude ? 1 : 0) + (sources.codex ? 1 : 0);
  if (!total) {
    console.error('No sources selected.');
    return { code: 1, published: false };
  }
  const scanP = startProgress('Scanning local Codex + Claude Code logs');
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
  scanP.succeed(`Scanned local logs — ${scanSummary}`);

  // 2. Aggregate + compute the API-equivalent $ (with progress).
  const computeP = startProgress('Computing the API-equivalent');
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
  const usd = totals.costUsd;
  // Per-day costUsd (same formula as the period total) → attach to each
  // token-only daily[] entry so the server can rank by calendar period
  // (month/year leaderboards).
  const dailyCost = aggregateDailyCost(agg.dailyModels, rateMap);
  const daily = agg.daily.map((d) => ({ ...d, costUsd: dailyCost.get(d.date) ?? 0 }));
  computeP.update(100);
  computeP.succeed(`Computed API-equivalent: $${fmtUsd(usd)}`);

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
  console.log(ATTRIBUTION);

  if (opts.subscriptionUsd && agg.firstDay && agg.lastDay) {
    const days = Math.max(
      1,
      Math.round((Date.parse(agg.lastDay) - Date.parse(agg.firstDay)) / 86400000) + 1,
    );
    const months = Math.max(1, days / 30);
    const subTotal = opts.subscriptionUsd * months;
    const ratio = subTotal > 0 ? usd / subTotal : 0;
    console.log(
      `Subscription: $${fmtUsd(opts.subscriptionUsd)}/mo × ${months.toFixed(1)} mo ≈ $${fmtUsd(subTotal)} → ` +
        `API-equivalent beat the subscription by ${ratio.toFixed(1)}×`,
    );
  }

  console.log('Only the aggregate (numbers) leaves this machine — never logs or keys.');

  const body = {
    nick,
    cliVersion,
    pricingVersion: rateMap.version,
    firstDay: agg.firstDay,
    lastDay: agg.lastDay,
    machineLabel: opts.machine,
    models: agg.models,
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
    const who = opts.bearer ? `@${nick} (via X)` : nick;
    const ok = await confirm(`Publish as ${who}? [y/N] `);
    if (!ok) {
      console.log('Cancelled.');
      return { code: 0, published: false };
    }
  }

  const pubP = startProgress(`Publishing as ${opts.bearer ? `@${nick} (via X)` : nick}`);
  const { status, json } = await publish(opts.api, body, opts.bearer);

  if (!json) {
    pubP.fail(`Unexpected server response: HTTP ${status}`);
    return { code: 1, published: false };
  }

  if (json.ok) {
    pubP.succeed('Published');
    if (opts.bearer) {
      console.log(`\nPublished under X account @${json.nick || nick}.`);
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
  const yes = await confirm(
    'Set up a daily auto-update? Keeps your number fresh on the leaderboard. [y/N] ',
  );
  if (!yes) return;
  const res = await installDaily();
  if (!res.ok) {
    console.error(`Could not set up the daily auto-update: ${res.detail || 'unknown error'}`);
    return;
  }
  const at = `${String(res.time.hour).padStart(2, '0')}:${String(res.time.minute).padStart(2, '0')}`;
  console.log(`✓ Daily auto-update is on (${res.platform}). It runs every day around ${at}.`);
  console.log('  Turn it off any time with: npx tokmax daily off');
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
  if (rawArgs[0] === 'login') return loginCmd(resolveApiBase(rawArgs));
  if (rawArgs[0] === 'logout') return logoutCmd(rawArgs, resolveApiBase(rawArgs));
  if (rawArgs[0] === 'daily') return dailyCmd(rawArgs);
  if (rawArgs[0] === 'publish') return publishCmd(rawArgs.slice(1));

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
