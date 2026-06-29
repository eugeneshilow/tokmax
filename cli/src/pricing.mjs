// Pricing: prices come from a bundled, pinned LiteLLM snapshot
// (./pricing/litellm-prices.json, native per-token) merged with our per-million
// override map (./pricing/overrides.mjs). The CLI resolves a model id to its
// rates and computes the API-equivalent $ with OUR formula (cache-read
// discounted). Fully offline — the CLI is the single source of truth for $:
// the publish payload now CARRIES the cost and the server just stores it.
//
// Attribution canon: prices = LiteLLM, counting = ccusage-style local logs.

import { readFile } from 'node:fs/promises';
import { FALLBACK, OVERRIDES } from './pricing/overrides.mjs';

/** Surfaced in the CLI preview, the profile page, the README, and npm. */
export const ATTRIBUTION = 'prices: LiteLLM · counting: ccusage';

const PER_MILLION = 1e6;

const SOURCE_LABELS = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
};

function round2(value) {
  return Math.round(value * 100) / 100;
}

/** LiteLLM per-token entry → our 5-bucket per-million rate. */
function normalizeLiteLLM(entry) {
  const input = (Number(entry.input_cost_per_token) || 0) * PER_MILLION;
  const output = (Number(entry.output_cost_per_token) || 0) * PER_MILLION;
  // OpenAI has no cache-write field → cacheCreate falls back to input rate.
  const cacheCreate =
    entry.cache_creation_input_token_cost != null
      ? Number(entry.cache_creation_input_token_cost) * PER_MILLION
      : input;
  // cacheRead is the DISCOUNTED cached-input rate (~0.1× input for Anthropic);
  // keep LiteLLM's value verbatim, fall back to input only if absent.
  const cacheRead =
    entry.cache_read_input_token_cost != null
      ? Number(entry.cache_read_input_token_cost) * PER_MILLION
      : input;
  const reasoning = output; // reasoning is billed as output
  return { input, output, cacheCreate, cacheRead, reasoning };
}

/**
 * Build the merged rate map: the bundled LiteLLM snapshot normalized to
 * per-million, with the override map taking precedence. OVERRIDE WINS for any
 * id/alias it covers — that pin keeps the dollar figure on our hand-verified
 * rates while LiteLLM supplies the maintained baseline + wider-family coverage.
 *
 * @returns {Promise<{models:Array<{id:string,aliases:string[],perMillion:object}>, fallback:object, version:string}>}
 */
export async function buildRateMap() {
  const raw = JSON.parse(
    await readFile(new URL('./pricing/litellm-prices.json', import.meta.url), 'utf8'),
  );
  const prices = raw.prices || {};

  // Everything the override map already covers (ids + aliases) → override wins.
  const covered = new Set();
  for (const o of OVERRIDES) {
    covered.add(o.id.toLowerCase());
    for (const a of o.aliases) covered.add(String(a).toLowerCase());
  }

  const litellm = [];
  for (const [id, entry] of Object.entries(prices)) {
    if (covered.has(id.toLowerCase())) continue; // override is authoritative
    litellm.push({ id, aliases: [], perMillion: normalizeLiteLLM(entry) });
  }

  // Override entries FIRST so resolveRates() hits them before any LiteLLM row.
  const models = [
    ...OVERRIDES.map((o) => ({ id: o.id, aliases: o.aliases, perMillion: o.perMillion })),
    ...litellm,
  ];

  return { models, fallback: FALLBACK, version: raw.version || 'unknown' };
}

/**
 * Resolve a model id to its perMillion rates.
 * Order: exact id -> alias -> longest prefix match (family heuristic) -> fallback.
 */
export function resolveRates(rateMap, model) {
  const id = String(model || '').toLowerCase();
  const models = rateMap.models || [];

  for (const m of models) {
    if (String(m.id).toLowerCase() === id) return m.perMillion;
  }
  for (const m of models) {
    if ((m.aliases || []).some((a) => String(a).toLowerCase() === id)) {
      return m.perMillion;
    }
  }
  // Family heuristic: pick the model whose id/alias is the longest prefix of the
  // requested id (e.g. "claude-opus-4-8-20990101" -> claude-opus-4-8). Longest
  // wins so "gpt-5.5" never collapses to the shorter "gpt-5" alias of a mini.
  let best = null;
  let bestLen = -1;
  for (const m of models) {
    for (const cand of [m.id, ...(m.aliases || [])]) {
      const c = String(cand).toLowerCase();
      if (id.startsWith(c) && c.length > bestLen) {
        best = m.perMillion;
        bestLen = c.length;
      }
    }
  }
  if (best) return best;

  return rateMap.fallback;
}

/** costUsd for a single model's token buckets (cache-read discounted via rate). */
export function costForModel(rates, tok) {
  return (
    (tok.input * rates.input +
      tok.output * rates.output +
      tok.cacheCreate * rates.cacheCreate +
      tok.cacheRead * rates.cacheRead +
      tok.reasoning * rates.reasoning) /
    PER_MILLION
  );
}

/**
 * Per-day costUsd, priced with the SAME per-model formula as the period total.
 * Input is aggregate()'s dailyModels — one entry per calendar day carrying that
 * day's per-model token buckets. Returns a date -> costUsd (round2) map so the
 * caller can attach costUsd to each token-only daily[] entry of the payload.
 *
 * @param {Array<{date:string, models:Array<object>}>} dailyModels
 * @returns {Map<string, number>}
 */
export function aggregateDailyCost(dailyModels, rateMap) {
  const byDate = new Map();
  for (const day of dailyModels) {
    let usd = 0;
    for (const m of day.models) {
      usd += costForModel(resolveRates(rateMap, m.model), {
        input: Math.max(0, m.input),
        output: Math.max(0, m.output),
        cacheCreate: Math.max(0, m.cacheCreate),
        cacheRead: Math.max(0, m.cacheRead),
        reasoning: Math.max(0, m.reasoning),
      });
    }
    byDate.set(day.date, round2(usd));
  }
  return byDate;
}

/** Sum costUsd across all aggregated model buckets (display convenience). */
export function previewCost(rateMap, models) {
  let usd = 0;
  for (const m of models) {
    usd += costForModel(resolveRates(rateMap, m.model), m);
  }
  return usd;
}

/**
 * Group per-model usage into per-tool sources (Codex / Claude Code), compute
 * each source's costUsd with OUR formula, and roll up totals. Mirrors the
 * server's old aggregateModels — but the CLI is now authoritative on $, so this
 * output (sources[] + totals, each carrying costUsd) is what the publish payload
 * carries. models[] stays token-only.
 *
 * @returns {{sources:Array<object>, totals:object}}
 */
export function aggregateSources(models, rateMap) {
  const byLabel = new Map();

  for (const m of models) {
    const usage = {
      input: Math.max(0, m.input),
      output: Math.max(0, m.output),
      cacheCreate: Math.max(0, m.cacheCreate),
      cacheRead: Math.max(0, m.cacheRead),
      reasoning: Math.max(0, m.reasoning),
    };
    const costUsd = costForModel(resolveRates(rateMap, m.model), usage);
    const tokens =
      usage.input + usage.output + usage.cacheCreate + usage.cacheRead + usage.reasoning;
    const label = SOURCE_LABELS[m.tool] || 'Other';

    const cur = byLabel.get(label) ?? {
      source: label,
      input: 0,
      output: 0,
      cacheCreate: 0,
      cacheRead: 0,
      reasoning: 0,
      totalTokens: 0,
      costUsd: 0,
    };
    cur.input += usage.input;
    cur.output += usage.output;
    cur.cacheCreate += usage.cacheCreate;
    cur.cacheRead += usage.cacheRead;
    cur.reasoning += usage.reasoning;
    cur.totalTokens += tokens;
    cur.costUsd += costUsd;
    byLabel.set(label, cur);
  }

  const sources = [...byLabel.values()].sort((a, b) => a.source.localeCompare(b.source));
  const totals = sources.reduce(
    (t, s) => {
      t.input += s.input;
      t.output += s.output;
      t.cacheCreate += s.cacheCreate;
      t.cacheRead += s.cacheRead;
      t.reasoning += s.reasoning;
      t.totalTokens += s.totalTokens;
      t.costUsd += s.costUsd;
      return t;
    },
    {
      input: 0,
      output: 0,
      cacheCreate: 0,
      cacheRead: 0,
      reasoning: 0,
      totalTokens: 0,
      costUsd: 0,
    },
  );

  for (const s of sources) s.costUsd = round2(s.costUsd);
  totals.costUsd = round2(totals.costUsd);

  return { sources, totals };
}
