# tokmax

**How much would your AI coding cost at API prices?** You're on a Codex / Claude
Code subscription — `tokmax` reads your local usage logs, works out what the same
tokens would have cost at pay-as-you-go **API prices**, and turns it into a
shareable page + a public leaderboard.

```bash
npx tokmax
```

It scans your logs, shows your number in the terminal, and publishes your page at
**tokmax.dev/your-handle**. Screenshot it, drop it in a chat, climb the
board. Sign in with X and every machine you code on merges into one combined total.

**Only numbers ever leave your machine** — never your prompts, code, API keys, or
raw logs. It's open source so you can check that yourself.

- 🔗 **Dashboard & leaderboard:** https://tokmax.dev
- ⚡ **Try it:** `npx tokmax` · options: `npx tokmax --help`
- 🗑️ **Your data, your call:** `npx tokmax daily off` · `npx tokmax delete`

---

### Repo layout (for contributors)

- [`cli/`](cli/) — the open-source `tokmax` CLI (the npm package): reads local
  JSONL logs, computes the API-equivalent **locally/offline**, publishes only
  aggregates. See [`cli/README.md`](cli/README.md).
- `web/` — Next.js + Convex: public profile pages, the leaderboard, and the
  hardened ingest endpoint. A separate Convex project, isolated from the main site.

Prices: LiteLLM · Counting: ccusage · License: [MIT](cli/LICENSE).
