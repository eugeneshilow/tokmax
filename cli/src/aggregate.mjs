// Merge raw adapter records into the publish payload shape:
//   - models: one disjoint-bucket entry per (tool, model)
//   - daily : per-day { codexTokens, claudeTokens } totals
//   - dailyModels: per-day per-model token buckets (used to price each calendar
//     day with the SAME formula as the period total → per-day costUsd for
//     month/year leaderboards)
//   - firstDay / lastDay actually observed (after --since filtering)
//
// All inputs are numeric aggregates already — this module is pure arithmetic.

/**
 * @param {Array<{records:Array}>} adapterResults
 * @param {{ since?: string|null }} opts  since = inclusive YYYY-MM-DD lower bound
 */
export function aggregate(adapterResults, { since = null } = {}) {
  const modelMap = new Map(); // `${tool}|${model}` -> bucket
  const dayMap = new Map(); // date -> { date, codexTokens, claudeTokens }
  // date -> Map(`${tool}|${model}` -> per-day model bucket). Kept separate from
  // dayMap so the publish payload's daily[] stays token-only; pricing turns this
  // into per-day costUsd (see aggregateDailyCost in pricing.mjs).
  const dayModelMap = new Map();
  let firstDay = null;
  let lastDay = null;

  for (const result of adapterResults) {
    for (const rec of result.records) {
      if (since && rec.date < since) continue;

      if (!firstDay || rec.date < firstDay) firstDay = rec.date;
      if (!lastDay || rec.date > lastDay) lastDay = rec.date;

      const key = `${rec.tool}|${rec.model}`;
      let bucket = modelMap.get(key);
      if (!bucket) {
        bucket = {
          model: rec.model,
          tool: rec.tool,
          input: 0,
          output: 0,
          cacheCreate: 0,
          cacheRead: 0,
          reasoning: 0,
        };
        modelMap.set(key, bucket);
      }
      bucket.input += rec.input;
      bucket.output += rec.output;
      bucket.cacheCreate += rec.cacheCreate;
      bucket.cacheRead += rec.cacheRead;
      bucket.reasoning += rec.reasoning;

      const total =
        rec.input + rec.output + rec.cacheCreate + rec.cacheRead + rec.reasoning;
      let day = dayMap.get(rec.date);
      if (!day) {
        day = { date: rec.date, codexTokens: 0, claudeTokens: 0 };
        dayMap.set(rec.date, day);
      }
      if (rec.tool === 'codex') day.codexTokens += total;
      else day.claudeTokens += total;

      // Per-day per-model buckets (for per-day cost). Same disjoint (tool,model)
      // bucketing as modelMap, just scoped to one calendar day.
      let dayModels = dayModelMap.get(rec.date);
      if (!dayModels) {
        dayModels = new Map();
        dayModelMap.set(rec.date, dayModels);
      }
      let dmBucket = dayModels.get(key);
      if (!dmBucket) {
        dmBucket = {
          model: rec.model,
          tool: rec.tool,
          input: 0,
          output: 0,
          cacheCreate: 0,
          cacheRead: 0,
          reasoning: 0,
        };
        dayModels.set(key, dmBucket);
      }
      dmBucket.input += rec.input;
      dmBucket.output += rec.output;
      dmBucket.cacheCreate += rec.cacheCreate;
      dmBucket.cacheRead += rec.cacheRead;
      dmBucket.reasoning += rec.reasoning;
    }
  }

  const models = [...modelMap.values()].filter(
    (m) =>
      m.input + m.output + m.cacheCreate + m.cacheRead + m.reasoning > 0,
  );
  const daily = [...dayMap.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const dailyModels = [...dayModelMap.entries()]
    .map(([date, models]) => ({ date, models: [...models.values()] }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totalTokens = models.reduce(
    (s, m) =>
      s + m.input + m.output + m.cacheCreate + m.cacheRead + m.reasoning,
    0,
  );

  return { models, daily, dailyModels, firstDay, lastDay, totalTokens };
}
