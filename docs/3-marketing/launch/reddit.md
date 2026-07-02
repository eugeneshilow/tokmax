# Reddit — launch kit

Date: 2026-07-02. Status: post AFTER the event (Jul 9+), one subreddit per
day, text posts (not bare links), numbers filled from prod. Same-day checks:
each sub's self-promo rules and required flair; disclose authorship in the
first line; repo link in the body (github.com is the trust link).

## r/ClaudeAI (primary — day 1)

**Title:** We ran a 7-day token-burn leaderboard during the Fable 5 launch —
here's the data (and the "is one Max enough?" math)

> Fable 5 launched capped at 50% of weekly limits, so we turned the question
> into an experiment: a public leaderboard of who burns the most, measured
> at API-equivalent prices from local logs, verified via X. 7 days: $___
> across ___ devs; peak day $___; the average pace implied a second $200
> Max pays back ___×.
>
> The tool behind it is `npx tokmax` — reads your local logs, computes the $
> locally (ccusage counting + LiteLLM rates), publishes only aggregate
> numbers, open source. It also shows your PROFIT/× — how many times your
> usage beat your plan price.
>
> Data, methodology and the anti-fraud design are public. AMA about any of
> it. [screenshots: week card + board]

## r/ChatGPTCoding (day 2 — Codex angle)

**Title:** Your Codex usage at API prices — measured, not vibes

> tokmax reads Codex + Claude Code logs together and prices both at API
> rates. Interesting split from the first cohort: $___ Codex vs $___ Claude
> per dev on average. One command, local computation, aggregates only,
> open source. Receipts in comments welcome.

## r/SideProject (day 3 — build story)

**Title:** I shipped a "Strava for AI coding spend" during a model launch
week — verified leaderboard + honest economics, open source

> Build story: one-command CLI (no deps), Next.js + Convex, terminal-styled
> receipt cards people actually screenshot, X OAuth for identity, and an
> event system — every major model launch gets a 7-day board. First event
> did $___ across ___ devs. What worked for virality: making the DEFAULT
> share artifact beautiful. What I'd do differently: [fill honestly
> post-event].

## r/artificial or r/OpenAI (day 4 — optional, data-first)

**Title:** Data from a week of "tokenmaxxing": what heavy AI-coding usage
looks like at API prices

Short data post; no product pitch until the comments ask for it.

## Rules of engagement

- One sub per day — near-identical simultaneous posts trip the spam filter.
- Text post + screenshots; links inside the body, never bare link-posts.
- Be in the comments the first hour; the guaranteed question is "does it
  really send only counts?" — answer with the payload function link.
- Skip any sub whose rules require mod pre-approval you don't have.
