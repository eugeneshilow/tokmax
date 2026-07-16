#!/usr/bin/env node
//
// Regenerate the pinned, trimmed LiteLLM snapshot bundled in the CLI
// (../src/pricing/litellm-prices.json).
//
// Upstream model_prices_and_context_window.json is ~1.5MB / thousands of
// entries. We keep only the models/families tokmax resolves, preserve LiteLLM's
// native PER-TOKEN keys verbatim, and stamp {version, source, commit}. The
// per-million normalization + override merge happen at load (src/pricing.mjs),
// not here — this file stays a faithful subset of upstream.
//
// Usage:
//   node scripts/refresh-litellm-prices.mjs           # fetch live upstream
//   TOKMAX_LITELLM_SRC=/path/to.json node scripts/... # trim a local copy
//
// scripts/ is NOT in package.json "files" → this dev tool never ships to npm.

import { readFile, writeFile } from 'node:fs/promises';

const SRC_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const OUT = new URL('../src/pricing/litellm-prices.json', import.meta.url);

// Native LiteLLM per-token keys we keep (the four our formula reads) + provider
// for provenance. Everything else (context windows, modes, flags) is dropped.
const KEEP_KEYS = [
  'input_cost_per_token',
  'output_cost_per_token',
  'cache_creation_input_token_cost',
  'cache_read_input_token_cost',
  'litellm_provider',
];

// The families tokmax resolves (Codex / OpenAI + Claude Code / Anthropic).
// Clean upstream keys only (no provider/region prefixes). Override map pins the
// dollar figure for the ones it covers; these give LiteLLM-sourced coverage for
// the wider family so future/sibling models don't fall to the flat fallback.
const KEYS = [
  // OpenAI / Codex line
  'gpt-5',
  'gpt-5-codex',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-pro',
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.6',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'o4-mini',
  'codex-mini-latest',
  // Anthropic / Claude Code line
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-opus-4-1',
  'claude-opus-4-5',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-3-opus-20240229',
  'claude-3-7-sonnet-20250219',
  'claude-3-haiku-20240307',
];

async function loadUpstream() {
  const local = process.env.TOKMAX_LITELLM_SRC;
  if (local) {
    return JSON.parse(await readFile(local, 'utf8'));
  }
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`upstream fetch failed: HTTP ${res.status}`);
  return res.json();
}

function pick(entry) {
  const out = {};
  for (const k of KEEP_KEYS) {
    if (entry[k] != null) out[k] = entry[k];
  }
  return out;
}

async function main() {
  const upstream = await loadUpstream();
  const prices = {};
  const missing = [];
  for (const key of KEYS) {
    const entry = upstream[key];
    if (!entry || typeof entry !== 'object') {
      missing.push(key);
      continue;
    }
    prices[key] = pick(entry);
  }

  const today = new Date().toISOString().slice(0, 10);
  const bundle = {
    version: process.env.TOKMAX_LITELLM_VERSION || today,
    source: 'BerriAI/litellm · model_prices_and_context_window.json',
    commit: process.env.TOKMAX_LITELLM_COMMIT || 'main',
    prices,
  };

  await writeFile(OUT, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(`wrote ${Object.keys(prices).length} models → ${OUT.pathname}`);
  if (missing.length) {
    console.warn(`WARN: ${missing.length} key(s) absent upstream: ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(`refresh failed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
