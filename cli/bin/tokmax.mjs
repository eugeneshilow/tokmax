#!/usr/bin/env node
//
// tokmax — scan local Codex + Claude Code logs, aggregate per-model token
// usage, preview the API-equivalent $, and publish the aggregate to the
// tokenmax leaderboard (tokmax.ru).
//
// Two ways to run:
//   npx tokmax            → short interactive onboarding (2 steps, progress bar)
//   npx tokmax <nick>     → fast direct path (no prompts)
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
import { fetchPricing, previewCost } from '../src/pricing.mjs';
import { publish } from '../src/publish.mjs';
import { loadSecret, saveSecret } from '../src/secrets.mjs';

const DEFAULT_API = 'https://chatty-boar-479.convex.site';
const PAGE_BASE = 'https://tokenmax.vibecoding.ru'; // canonical served page (availability check)
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
          console.error(`Неизвестный флаг: ${a}`);
          process.exit(2);
        }
        rest.push(a);
    }
  }
  if (!opts.nick && rest.length) opts.nick = rest[0];
  if (opts.api) opts.api = opts.api.replace(/\/+$/, '');
  return opts;
}

const HELP = `tokmax — публичный счётчик API-equivalent расхода токенов

Запуск:
  npx tokmax            короткий онбординг (2 шага, прогресс-бар)
  npx tokmax <nick>     быстрый прямой путь без вопросов

Options:
  --since YYYY-MM-DD   считать только с этого дня (по умолчанию — вся история)
  --key <secret>       capability-токен для обновления уже занятого ника
  --api <baseUrl>      базовый URL API (по умолчанию tokenmax deployment)
  --machine <label>    метка машины (по умолчанию hostname)
  --onboard            принудительно запустить онбординг
  --dry-run            показать превью и тело запроса, ничего не публиковать
  --yes, -y            не спрашивать подтверждение
  --help, -h           показать эту справку`;

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
      resolve(/^(y(es)?|д(а)?)$/i.test(answer.trim()));
    });
  });
}

// ── Onboarding ──────────────────────────────────────────────────────────────

function progressBar(step, total) {
  const cells = 14;
  const filled = Math.round((step / total) * cells);
  return `[${'█'.repeat(filled)}${'░'.repeat(cells - filled)}]  шаг ${step}/${total}`;
}

function validateNick(raw) {
  const nick = String(raw || '').trim();
  if (!nick) return { ok: false, msg: 'пустой ник' };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/.test(nick)) {
    return {
      ok: false,
      msg: 'только латиница/цифры/дефис/подчёркивание, 2–32 символа, начинается с буквы или цифры',
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

async function runOnboarding(cliVersion) {
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
    nick: null,
    since: null,
    sources: { claude: true, codex: true },
    subscriptionUsd: null,
  };
  try {
    console.log(`\n  tokmax v${cliVersion} — публичный счётчик твоих токенов`);
    console.log(`  Соберём твою страницу на ${PAGE_BASE.replace('https://', '')}/<ник>.\n`);

    // ── Step 1/2 — ник ──
    console.log(progressBar(1, 2));
    for (;;) {
      const raw = await ask('Шаг 1/2 · придумай ник: ');
      const v = validateNick(raw);
      if (!v.ok) {
        console.log(`  ✗ ${v.msg}\n`);
        continue;
      }
      process.stdout.write('  проверяю занятость…');
      const avail = await checkAvailability(v.nick.toLowerCase());
      process.stdout.write('\r\x1b[K');
      if (avail === 'taken') {
        const a = await ask(
          rl,
          `  ✗ «${v.nick}» уже занят. [д] это мой — обновить · [Enter] выбрать другой: `,
        );
        if (/^(д(а)?|y(es)?)$/i.test(a.trim())) {
          config.nick = v.nick;
          break;
        }
        console.log('');
        continue;
      }
      console.log(avail === 'free' ? `  ✓ «${v.nick}» свободен\n` : `  · беру «${v.nick}»\n`);
      config.nick = v.nick;
      break;
    }

    // ── Step 2/2 — режим ──
    console.log(progressBar(2, 2));
    console.log('Шаг 2/2 · как считать?');
    console.log('  [1] По умолчанию — вся история, Codex + Claude Code  (рекомендую)');
    console.log('  [2] Настроить — период, источники, подписка');
    const mode = (await ask('  выбор [1/2, Enter=1]: ')).trim();

    if (mode === '2') {
      // период
      for (;;) {
        const s = (await ask('  период — с какой даты? (YYYY-MM-DD, Enter = вся история): ')).trim();
        if (!s) break;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          config.since = s;
          break;
        }
        console.log('  ✗ формат YYYY-MM-DD');
      }
      // источники
      const src = (
        await ask('  источники — [Enter] оба · [c] только Claude Code · [x] только Codex: ')
      )
        .trim()
        .toLowerCase();
      if (src === 'c') config.sources = { claude: true, codex: false };
      else if (src === 'x') config.sources = { claude: false, codex: true };
      // подписка
      const sub = (await ask('  сколько платишь за подписки в месяц, $? (Enter = пропустить): ')).trim();
      const n = Number(sub.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) config.subscriptionUsd = n;
    }
    console.log('');
  } finally {
    if (rl) rl.close();
  }
  return config;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const cliVersion = await readPackageVersion();

  // No nick + interactive terminal (or --onboard) → run the onboarding.
  if (opts.onboard || (!opts.nick && process.stdin.isTTY)) {
    const cfg = await runOnboarding(cliVersion);
    if (!cfg.nick) {
      console.error('Онбординг отменён.');
      return 1;
    }
    opts.nick = cfg.nick;
    opts.since = cfg.since;
    opts.sources = cfg.sources;
    opts.subscriptionUsd = cfg.subscriptionUsd;
  }

  if (!opts.nick) {
    console.error('Укажи ник: npx tokmax <nick>  (или запусти npx tokmax без аргументов)');
    return 2;
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
    console.error(`--since должен быть YYYY-MM-DD, получено: ${opts.since}`);
    return 2;
  }

  const nick = opts.nick.trim();
  const nickKey = nick.toLowerCase();

  console.log(`tokmax v${cliVersion} · ник: ${nick}`);
  console.log('Сканирую локальные логи…');

  const sources = opts.sources || { claude: true, codex: true };
  const tasks = [];
  if (sources.claude) tasks.push(scanClaudeCode().then((r) => ({ tool: 'claude', r })));
  if (sources.codex) tasks.push(scanCodex().then((r) => ({ tool: 'codex', r })));
  if (!tasks.length) {
    console.error('Не выбрано ни одного источника.');
    return 1;
  }
  const wrapped = await Promise.all(tasks);
  const scanned = wrapped.map((w) => w.r);
  console.log(
    '  ' +
      wrapped
        .map((w) =>
          w.tool === 'claude'
            ? `Claude Code: ${w.r.sessionCount} сессий`
            : `Codex: ${w.r.sessionCount} сессий`,
        )
        .join(' · '),
  );

  const agg = aggregate(scanned, { since: opts.since });

  if (!agg.models.length || agg.totalTokens === 0) {
    console.error(
      'Не нашёл токенов в логах (с учётом фильтров). Публиковать нечего.',
    );
    return 1;
  }

  let pricing;
  try {
    pricing = await fetchPricing(opts.api);
  } catch (err) {
    console.error(`Не удалось получить прайсинг: ${err.message}`);
    return 1;
  }

  const usd = previewCost(pricing, agg.models);

  console.log(
    `Период: ${agg.firstDay} → ${agg.lastDay}` +
      (opts.since ? ` · фильтр с ${opts.since}` : ' (всё, что нашлось)'),
  );
  console.log('Модели:');
  for (const m of agg.models) {
    const tot = m.input + m.output + m.cacheCreate + m.cacheRead + m.reasoning;
    console.log(`  ${m.tool}/${m.model}: ${fmtInt(tot)} токенов`);
  }
  console.log(`Всего токенов: ${fmtInt(agg.totalTokens)}`);
  console.log(`API-equivalent: $${fmtUsd(usd)}`);

  // Subscription comparison (CLI-side preview of the flex).
  if (opts.subscriptionUsd && agg.firstDay && agg.lastDay) {
    const days = Math.max(
      1,
      Math.round((Date.parse(agg.lastDay) - Date.parse(agg.firstDay)) / 86400000) + 1,
    );
    const months = Math.max(1, days / 30);
    const subTotal = opts.subscriptionUsd * months;
    const ratio = subTotal > 0 ? usd / subTotal : 0;
    console.log(
      `Подписка: $${fmtUsd(opts.subscriptionUsd)}/мес × ${months.toFixed(1)} мес ≈ $${fmtUsd(subTotal)} → ` +
        `API-equivalent отбил подписку в ${ratio.toFixed(1)}×`,
    );
  }

  console.log('Наружу уйдёт только агрегат (числа), не логи и не ключи.');

  const body = {
    nick,
    cliVersion,
    pricingVersion: pricing.version,
    firstDay: agg.firstDay,
    lastDay: agg.lastDay,
    machineLabel: opts.machine,
    models: agg.models,
    daily: agg.daily,
    ...(opts.subscriptionUsd ? { subscriptionUsd: opts.subscriptionUsd } : {}),
  };

  if (opts.dryRun) {
    console.log('\n--dry-run: тело запроса, которое было бы отправлено:');
    console.log(JSON.stringify(body, null, 2));
    console.log('\n(ничего не опубликовано)');
    return 0;
  }

  // Capability token: explicit --key wins, else a saved secret for this nick.
  const savedSecret = await loadSecret(nickKey);
  const secret = opts.key || savedSecret;
  if (secret) body.secret = secret;

  if (!opts.yes) {
    const ok = await confirm(`Опубликовать как ${nick}? [y/N] `);
    if (!ok) {
      console.log('Отменено.');
      return 0;
    }
  }

  const { status, json } = await publish(opts.api, body);

  if (!json) {
    console.error(`Неожиданный ответ сервера: HTTP ${status}`);
    return 1;
  }

  if (json.ok) {
    if (json.created && json.secret) {
      const file = await saveSecret(nickKey, {
        nick: json.nick || nickKey,
        secret: json.secret,
        url: json.url,
        createdAt: Date.now(),
      });
      console.log(`\nСохранил capability-токен: ${file} (chmod 600)`);
      console.log('Не теряй его — он нужен для будущих обновлений ника.');
    } else {
      console.log('\nОбновил существующий профиль.');
    }
    console.log(`costUsd: $${fmtUsd(json.costUsd)} · токенов: ${fmtInt(json.totalTokens)}`);
    if (json.suspicious) {
      console.log('⚠️  Сервер пометил сабмит как suspicious (на ручную проверку).');
    }
    console.log(`\n  Готово! Твоя страница: ${json.url}\n`);
    return 0;
  }

  // Documented error reasons.
  switch (json.reason) {
    case 'nick_taken':
      console.error(`Ник занят: ${json.message || nick}`);
      if (json.suggestion) console.error(`Попробуй: ${json.suggestion}`);
      console.error(
        'Если это твой ник — обнови через --key <secret> (capability-токен).',
      );
      return 1;
    case 'rate_limited':
      console.error(`Слишком часто: ${json.message || 'rate limited'}`);
      return 1;
    case 'nick_invalid':
      console.error(`Недопустимый ник: ${json.message || nick}`);
      return 1;
    case 'empty_usage':
      console.error('Сервер: пустой агрегат (empty_usage).');
      return 1;
    case 'invalid_payload':
      console.error(`Некорректное тело запроса: ${json.message || ''}`);
      return 1;
    default:
      console.error(`Ошибка публикации (HTTP ${status}): ${JSON.stringify(json)}`);
      return 1;
  }
}

main()
  .then((code) => process.exit(code || 0))
  .catch((err) => {
    console.error(`Сбой: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  });
