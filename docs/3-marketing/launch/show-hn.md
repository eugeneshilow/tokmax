TITLE (paste into the title field):

Show HN: tokmax – what your Codex/Claude Code usage would cost at API prices

---

URL (paste into the url field):

https://tokmax.dev

---

BODY (post as the FIRST COMMENT, right after submitting — leave HN's text field EMPTY; HN can't accept a url and text together):

`npx tokmax` reads your local Codex and Claude Code logs and tells you what your token usage would have cost at API prices — instead of the flat subscription you actually pay.

My own number: ~$2,870 · 3.5B tokens · ~3 weeks of API-equivalent tokens. That's the hook, honestly — it's an absurd number and I wanted to see everyone else's.

Privacy first, because I'd be suspicious of this too. Only aggregates leave your machine: token counts per model, dates, and a machine label you set. Never your prompts, code, file contents, tool output, or API keys. It's open source (github.com/eugeneshilow/tokmax), so you can read exactly what gets sent before you run it.

How it works:

- Scans the session logs Codex and Claude Code already write locally.
- Sums tokens per model.
- Dedupes session resumes, so context replayed across continued sessions isn't double-counted.
- The client sends only counts; the server recomputes the dollar figure from those counts at public per-model rates, so the conversion can't be fudged.
- You get a profile at tokmax.dev/<nick> and a spot on a public leaderboard (who burned the most).

Optional: enter your $/mo subscription and the page shows how many times over your usage paid back the sub (API-equivalent ÷ subscription = N×).

Zero install, zero runtime deps, Node 18+. No signup, no account, no email to run it. It's free — a build-in-public side project, not a startup. I'm not affiliated with OpenAI or Anthropic.

What I'd like feedback on:

- The dedupe logic. Session-resume accounting is the part I'm least sure about — if your counts look off, I want the repro.
- Whether the per-model rates I'm using match what you'd expect, and the edge cases where they'd be wrong.
- Whether "API-equivalent $" is even the right framing, or if there's a less misleading way to say "what you'd pay without the subscription."
