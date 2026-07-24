// Override / gap map — PER-MILLION rates ($ per 1,000,000 tokens), 5 buckets.
//
// Why this exists alongside the bundled LiteLLM snapshot:
//   1) LiteLLM lacks (or names differently) our synthetic/dated model ids and
//      the bare Anthropic short ids that show up in local logs
//      (gpt-5.5-codex, claude-opus-4-8[1m], claude-3-5-haiku, …).
//   2) The override is seeded 1:1 from the old hand-kept server table, so the
//      published dollar figure does NOT move when we switch the source to
//      LiteLLM. Override WINS over the snapshot for any id/alias it covers
//      (see buildRateMap in ../pricing.mjs) — these numbers are the pin.
//
// Buckets: input / output / cacheCreate / cacheRead / reasoning.
// The cache-read DISCOUNT (~0.1× input for Anthropic) lives in cacheRead here,
// so the cost FORMULA stays unchanged. Per-million (not per-token) on purpose —
// avoids the ×1e6 confusion on these gap rows.

export const OVERRIDES = [
  // ---- OpenAI / Codex ----
  {
    id: 'gpt-5.5',
    aliases: ['gpt-5.5-codex', 'gpt-5-codex', 'gpt-5', 'codex'],
    perMillion: { input: 5, output: 30, cacheCreate: 5, cacheRead: 0.5, reasoning: 30 },
  },
  {
    id: 'gpt-5.4',
    aliases: ['gpt-5.4-codex'],
    perMillion: { input: 2.5, output: 15, cacheCreate: 2.5, cacheRead: 0.25, reasoning: 15 },
  },
  {
    id: 'gpt-5.4-mini',
    aliases: ['gpt-5-mini', 'gpt-5.5-mini', 'o4-mini'],
    perMillion: { input: 0.75, output: 4.5, cacheCreate: 0.75, cacheRead: 0.075, reasoning: 4.5 },
  },
  // gpt-5.6 family: without these pins the prefix heuristic collapsed every
  // 5.6 variant to the "gpt-5" alias (= gpt-5.5 rates, $5/$30) — luna was
  // billed 5-6x too high. Rates per OpenAI list prices.
  {
    id: 'gpt-5.6-sol',
    aliases: ['gpt-5.6', 'gpt-5.6-codex'],
    perMillion: { input: 5, output: 30, cacheCreate: 5, cacheRead: 0.5, reasoning: 30 },
  },
  {
    id: 'gpt-5.6-terra',
    aliases: [],
    perMillion: { input: 2.5, output: 15, cacheCreate: 2.5, cacheRead: 0.25, reasoning: 15 },
  },
  {
    id: 'gpt-5.6-luna',
    aliases: [],
    perMillion: { input: 1, output: 6, cacheCreate: 1, cacheRead: 0.1, reasoning: 6 },
  },
  // ---- Anthropic / Claude Code ----
  {
    id: 'claude-fable-5',
    aliases: ['fable-5', 'fable'],
    perMillion: { input: 10, output: 50, cacheCreate: 12.5, cacheRead: 1.0, reasoning: 50 },
  },
  {
    id: 'claude-opus-4-8',
    aliases: ['claude-opus-4-8[1m]', 'claude-opus-4-1', 'claude-3-opus', 'opus'],
    perMillion: { input: 5, output: 25, cacheCreate: 6.25, cacheRead: 0.5, reasoning: 25 },
  },
  {
    id: 'claude-sonnet-4-6',
    aliases: ['claude-sonnet-4-5', 'claude-3-5-sonnet', 'claude-3-7-sonnet', 'sonnet'],
    perMillion: { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.3, reasoning: 15 },
  },
  // Sonnet 5: INTRODUCTORY pricing through 2026-08-31 (LiteLLM 6e023f7cf2,
  // applied upstream 2026-07-01). The old 3/15 pin was stale at birth — it was
  // verified against our hand-kept table instead of LiteLLM and overbilled
  // Sonnet 5 by 1.5x. Revisit after 2026-08-31: if upstream reverts to 3/15,
  // this pin follows.
  {
    id: 'claude-sonnet-5',
    aliases: ['sonnet-5'],
    perMillion: { input: 2, output: 10, cacheCreate: 2.5, cacheRead: 0.2, reasoning: 10 },
  },
  {
    id: 'claude-haiku-4-5',
    aliases: ['claude-3-5-haiku', 'claude-3-haiku', 'haiku'],
    perMillion: { input: 1, output: 5, cacheCreate: 1.25, cacheRead: 0.1, reasoning: 5 },
  },
];

// Fallback for a model neither the override nor the LiteLLM snapshot resolves:
// a mid-conservative rate so a new model neither zeroes nor absurdly inflates $.
export const FALLBACK = {
  input: 3,
  output: 15,
  cacheCreate: 3.75,
  cacheRead: 0.3,
  reasoning: 15,
};
