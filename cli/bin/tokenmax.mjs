#!/usr/bin/env node
//
// tokenmax — scan local Codex + Claude Code logs, aggregate per-model
// token usage, preview the API-equivalent $, and publish the aggregate to the
// tokenmax leaderboard (tokenmax.ru).
//
// Happy path is one command:
//   npx tokenmax-ru <nick>
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    nick: null,
    since: null,
    key: null,
    api: DEFAULT_API,
    machine: os.hostname(),
    dryRun: false,
    yes: false,
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

const HELP = `tokenmax <nick> [options]

  Сканирует локальные логи Codex и Claude Code, считает токены по моделям,
  показывает API-equivalent в долларах и публикует агрегат на лидерборд
  tokenmax.ru. Наружу уходят только числа — не логи и не ключи.

Options:
  --since YYYY-MM-DD   считать только с этого дня (по умолчанию — вся история)
  --key <secret>       capability-токен для обновления уже занятого ника
  --api <baseUrl>      базовый URL API (по умолчанию tokenmax deployment)
  --machine <label>    метка машины (по умолчанию hostname)
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

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (!opts.nick) {
    console.error('Укажи ник: npx tokenmax-ru <nick>  (--help для справки)');
    return 2;
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
    console.error(`--since должен быть YYYY-MM-DD, получено: ${opts.since}`);
    return 2;
  }

  const nick = opts.nick.trim();
  const nickKey = nick.toLowerCase();
  const cliVersion = await readPackageVersion();

  console.log(`tokenmax v${cliVersion} · ник: ${nick}`);
  console.log('Сканирую локальные логи…');

  const [claude, codex] = await Promise.all([scanClaudeCode(), scanCodex()]);

  console.log(
    `  Claude Code: ${claude.sessionCount} сессий · Codex: ${codex.sessionCount} сессий`,
  );

  const agg = aggregate([claude, codex], { since: opts.since });

  if (!agg.models.length || agg.totalTokens === 0) {
    console.error(
      'Не нашёл токенов в логах (с учётом --since). Публиковать нечего.',
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
    `Период: ${agg.firstDay} → ${agg.lastDay} (всё, что нашлось)` +
      (opts.since ? ` · фильтр --since ${opts.since}` : ''),
  );
  console.log('Модели:');
  for (const m of agg.models) {
    const tot = m.input + m.output + m.cacheCreate + m.cacheRead + m.reasoning;
    console.log(`  ${m.tool}/${m.model}: ${fmtInt(tot)} токенов`);
  }
  console.log(`Всего токенов: ${fmtInt(agg.totalTokens)}`);
  console.log(`API-equivalent: $${fmtUsd(usd)}`);
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
    console.log(`\n  ${json.url}\n`);
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
