# tokmax

Measures how many tokens you burned in **Codex** and **Claude Code** on this
machine, converts that into **API-equivalent** dollars, and publishes the
aggregate to the public leaderboard at
[tokmax.vibecoding.tech](https://tokmax.vibecoding.tech).

One command — a short onboarding with a progress bar:

```bash
npx tokmax
```

You choose how to publish:

- **Sign in with X** (recommended) — your page name is your `@handle`. Adds
  identity, multi-machine merge (run it on another machine and the totals
  combine automatically), a verified badge, and an optional daily auto-update.
- **Quick (anonymous)** — just pick a nick and publish.

After publishing, your page is live at `https://tokmax.vibecoding.tech/<nick>`.

## What leaves the machine (and what does not)

This is a tool about trust, so the boundary is strict and verifiable in the code
(`src/adapters/*.mjs`):

- **Only the aggregate is sent:** per-model token counts (`input`, `output`,
  `cacheCreate`, `cacheRead`, `reasoning`), the per-day dates, and the
  **locally-computed `costUsd`** (per-source aggregate + total) — still a derived
  number, not raw material.
- **Never sent:** prompt text, file contents, tool output, API keys, raw log
  lines. The adapters read exactly four-or-five numeric usage fields per log line
  plus the model id and a timestamp, and drop everything else.

It's open source so you can read this yourself rather than take it on faith.

## Install & run

Needs Node.js >= 18. Zero runtime dependencies (just built-in Node modules and
the global `fetch`).

```bash
# one-off, no install — starts the onboarding
npx tokmax

# or globally
npm i -g tokmax
tokmax

# sign in with X and publish this machine in one go
npx tokmax login

# publish an additional machine (same X login) — totals merge automatically
npx tokmax login
```

### Options

```text
tokmax [<nick>] [options]

  login                sign in with X and publish this machine
  logout               sign out on this machine (logout --all = every machine)
  daily on|off|status  the daily auto-update
  --onboard            force the onboarding flow
  --since YYYY-MM-DD    count only from this day (default: whole history)
  --api <baseUrl>      API base URL
  --dry-run            show the preview + request body, publish nothing
  --yes, -y            skip the confirmation prompt
  --help, -h           help
```

`--dry-run` prints the preview and the exact request body that would be sent —
handy to confirm with your own eyes that only numbers go out.

## How the dollar is computed

**Prices: LiteLLM · Counting: ccusage.**

Rates come from a pinned [LiteLLM](https://github.com/BerriAI/litellm) snapshot
bundled in the package (`src/pricing/litellm-prices.json`) plus our local override
map (`src/pricing/overrides.mjs`) for synthetic/dated ids LiteLLM doesn't have.
The CLI computes the dollar **locally, offline**, with our formula — a sum over
models of `(input·r.input + output·r.output + cacheCreate·r.cacheCreate +
cacheRead·r.cacheRead + reasoning·r.reasoning) / 1e6`, where `r` is the
per-million rate for the recognized model (or a fallback for an unknown one).
Cache reads (`cacheRead`) use the discounted rate (~0.1× input), not the full
rate — so the number is honest.

The CLI then **puts the computed `costUsd` straight into the published aggregate**
(`sources[]` + `totals`); the server just **stores and shows it** — it never
recomputes. The terminal preview == the published number by construction.

Refresh the bundled price snapshot from upstream LiteLLM: `npm run prices:refresh`.

## Where the numbers come from

- **Claude Code:** `~/.claude*/projects/**/*.jsonl` — usage from assistant
  messages (`message.usage`).
- **Codex:** `~/.codex/sessions/**/*.jsonl` and
  `~/.codex/archived_sessions/*.jsonl` — `token_count` events (per-turn deltas).

Each source is isolated in its own adapter (`src/adapters/`) and works
defensively: broken lines and missing fields are simply skipped (default 0).

## Endpoint

By default the CLI talks to the isolated tokmax deployment — only to the hardened
publish route. The dollar is computed locally (offline); the network is needed
only to publish the aggregate. Override the base URL with `--api <baseUrl>`.

## License

MIT — see [LICENSE](LICENSE).
