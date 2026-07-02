# Show HN — launch kit

Date: 2026-07-02. Status: post Jul 9-11 (not the same day as PH), after the
event supplies data. HN wants engineering honesty, not marketing — the angle
is "we ran an experiment, here's the data and the anti-fraud design".

## Title (pick one)

- A: "Show HN: Tokmax – what your AI coding would cost at API prices"
- B: "Show HN: We ran a 7-day token-burn leaderboard during the Fable 5 launch"
- C: "Show HN: Tokenmaxxing – verified leaderboard of AI coding token burn"

URL: https://tokmax.dev (A) or https://tokmax.dev/fable-5 (B).

## Text (first comment, posted immediately by the author)

> During the Fable 5 launch week (Anthropic capped it at 50% of weekly
> limits) we ran a public experiment: a leaderboard of who burns the most
> tokens, measured at API-equivalent prices. Results: $___ across ___
> participants in 7 days.
>
> How it works: `npx tokmax` reads your local Codex/Claude Code JSONL logs,
> counts tokens with ccusage's methodology (dedup by message+request id),
> prices them with LiteLLM's rate table, computes the total locally, and
> publishes ONLY aggregate numbers — per-day, per-model token counts and
> dollars. No prompts, no file paths, no keys. The payload is inspectable in
> the code, and the profile page shows exactly what was sent.
>
> The interesting design problem was fraud: it's self-reported data. Current
> answers: identity via X OAuth (rank links to a real account), per-window
> plausibility caps, divergence gates between the per-day series and totals,
> and anonymized machine labels (early versions leaked hostnames — fixed).
> It's abuse-resistant, not fraud-proof, and the site says so.
>
> The economics side: it computes whether your usage beat your subscription
> (API-equivalent ÷ plan price) and whether your launch-week pace means a
> second subscription pays for itself. Labeled as a decision aid — the $ is
> API-equivalent value, not cash saved.
>
> Stack: CLI is dependency-free Node; site is Next.js + Convex. MIT.
> Happy to answer anything about the counting, the caps, or the data.

## Comment-defense FAQ (draft replies live here; the owner posts)

- **"API-equivalent is fake money."** Correct — and it's labeled that way
  everywhere. It's the market price of the same tokens, the only neutral
  yardstick across subscriptions. The PROFIT/× framing exists precisely
  because people pay flat rates.
- **"Self-reported = worthless."** Self-reported with verified identity,
  window gates and plausibility caps. Same trust model as Strava. We publish
  the anti-fraud design and its limits; a server-side recompute of $ from
  token counts is the next hardening step.
- **"Burning tokens is wasteful."** The board measures value, not virtue.
  The PROFIT metric is literally about paying less per unit of work.
  Optimization is the point — the flex is the distribution mechanism.
- **"Privacy?"** Only aggregates leave the machine; the exact payload is one
  function in the open-source CLI; `tokmax delete` purges account-wide and
  is idempotent across machines. Profiles are noindex.
- **"Why X sign-in?"** Anti-fraud + the prize IS the follow-back. Anonymous
  publishing works too (capability token), it's just labeled unverified.

## Timing & conduct

Post 7-9am PT Tue-Thu. One submission, no resubmit-begging, no vote rings.
Author stays in the thread for the first 3 hours and answers everything —
tone: engineer, receipts, zero marketing adjectives.
