# Methodology

tokmax converts local usage logs into an API-equivalent dollar estimate.

Inputs:

- Codex usage records.
- Claude Code usage records.
- Token buckets by model: input, output, cache creation, cache read, and reasoning.

Pricing:

- The CLI uses a pinned LiteLLM price snapshot plus local override rows for known gaps.
- The CLI is authoritative for cost calculation and sends computed totals to the server.
- The server stores the submitted cost values and applies abuse checks; it does not reprice tokens.

Aggregation:

- `models`: all-time token buckets by tool and model.
- `modelSpend`: all-time computed spend by tool and model.
- `daily`: per-day token totals and per-day cost.
- `dailyModelSpend`: per-day computed spend by tool and model.

Leaderboards:

- Main leaderboard ranks by profile all-time cost.
- Period leaderboard ranks by summed per-day cost for the selected calendar period.
- Special model leaderboards rank by per-day model spend inside their fixed launch window.
