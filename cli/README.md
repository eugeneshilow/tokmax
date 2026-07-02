# tokmax

**How much would your AI coding cost at API prices?** You're on a Codex / Claude
Code subscription — `tokmax` reads your local usage logs, works out what the same
tokens would have cost at pay-as-you-go **API prices**, and turns it into a
shareable page + a public leaderboard.

One command, nothing to sign up for first:

```bash
npx tokmax
```

It scans your logs, shows your number in the terminal, and publishes your page at
**tokmax.dev/your-handle**. Screenshot it, drop it in a chat, climb
the leaderboard.

## Why people run it

- **A real number.** Not "I use it a lot" — an actual dollar figure at API rates,
  computed locally with [LiteLLM](https://github.com/BerriAI/litellm) prices and
  [ccusage](https://github.com/ryoppippi/ccusage) counting.
- **A page you can flex.** `tokmax.dev/<you>` with your totals, your
  daily burn in dollars, and your rank.
- **Every machine, one total.** Run it on your laptop and your server — sign in
  once with X and they merge into a single combined number automatically.

## Getting started

Needs Node.js 18+. Zero install required — `npx` runs it.

```bash
# the guided way — pick how to publish, then it computes + publishes
npx tokmax

# sign in with X (recommended): your page is your @handle, and extra machines
# merge automatically. This signs you in AND publishes this machine.
npx tokmax login

# keep it fresh automatically (optional) — offered after you publish
npx tokmax daily on
```

When you publish, it opens your page in the browser. To add another computer,
just run `npx tokmax login` there with the same X account.

## Your data stays yours

It's open source so you can verify this in `src/adapters/`:

- **Only numbers leave your machine** — per-model token counts, the per-day dates,
  and the dollar figure computed locally on your side.
- **Your prompts, code, tool output, API keys, and raw logs never leave.** The
  adapters read a handful of numeric usage fields per log line and ignore the rest.

Want to see exactly what would be sent without sending anything? `npx tokmax --dry-run`.

## Managing your page

```bash
npx tokmax daily off    # stop the daily auto-update on this machine
npx tokmax logout       # sign out on this machine (logout --all = everywhere)
npx tokmax delete       # permanently remove your page + account
```

## How the dollar is computed

Rates come from a pinned LiteLLM snapshot bundled in the package, plus a small
override map for model ids LiteLLM doesn't list yet. The dollar is computed
**locally and offline** — a per-model sum of `tokens × per-million rate`, with
cache reads charged at the discounted rate (~0.1× input) so the figure is honest.
The computed number is what gets published; the terminal preview equals your page
by construction.

Full options: `npx tokmax --help`.

## License

MIT — see [LICENSE](LICENSE).
