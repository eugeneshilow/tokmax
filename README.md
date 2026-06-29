# tokmax

A public token-maxing meter: how much value, at API prices, you squeezed out of
your local AI-coding agents (Codex, Claude Code). An isolated product in the
**vibecoding** line.

Prices: LiteLLM · Counting: ccusage.

- `cli/` — the open-source CLI `tokmax` (`npx tokmax`): reads your local JSONL
  logs, computes aggregates, and publishes them. Only numbers ever leave your
  machine — never raw logs or keys.
- `web/` — Next.js + Convex: the public dashboards at
  `tokmax.vibecoding.tech/<nick>`, the leaderboard, and the ingest endpoint. A
  separate Convex project, isolated from the main site.

Dashboard: https://tokmax.vibecoding.tech
