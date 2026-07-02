## 1. NAME

**tokmax**

---

## 2. TAGLINE (≤60 chars)

**See your token burn in API dollars. Then flex it.**
*(49 chars)*

Alternates to A/B:
- `Your subscription vs API prices, in one command.` (48)
- `What your AI coding would cost at API prices.` (45)

---

## 3. DESCRIPTION (~3–5 sentences)

tokmax reads your local Codex and Claude Code logs and answers one question: what would your token usage have cost at raw API prices instead of a flat subscription? Run `npx tokmax` — no install, no signup, no account, no email. You get your number (the maker's: **~$2,870 · 3.5B tokens · ~3 weeks** of API-equivalent usage), a public profile at `tokmax.dev/<nick>`, and a spot on the leaderboard. Enter your $/mo plan and it shows how many times over your usage paid back the subscription (API-equivalent ÷ subscription = N×).

**Privacy:** only aggregates ever leave your machine — token counts per model, dates, and a machine label. Never your prompts, code, file contents, tool output, or API keys. It's open source, so check the code yourself: github.com/eugeneshilow/tokmax

---

## 4. FIRST MAKER COMMENT

Hey Product Hunt 👋

I'm an indie dev who basically lives inside Codex and Claude Code. One night I got curious: I'm on flat subscriptions, but what would all this token burn have actually cost at raw API prices?

So I wrote a quick script to read my local logs and add it up. The number made me laugh: **~$2,870 · 3.5B tokens · ~3 weeks** of API-equivalent tokens. I screenshotted it, posted it, and friends immediately wanted their own number. So I cleaned it up into `npx tokmax`.

The privacy part mattered to me, because I'd never run a tool that ships my code or prompts off my machine. So tokmax doesn't. **Only aggregates leave your machine: token counts per model, dates, and a machine label. Never your prompts, code, file contents, tool output, or API keys.** It's open source — read it, fork it, distrust me and check: github.com/eugeneshilow/tokmax

Under the hood: it dedupes (session resumes don't double-count), and the server recomputes the dollar figure from your token counts at public per-model rates, so the conversion can't be fudged. You can also punch in your $/mo subscription and see how many times over your usage paid back the plan (API-equivalent ÷ subscription = N×).

No signup, no account, no email. Just:

```
npx tokmax
```

You'll get a profile at `tokmax.dev/<nick>` and a spot on the leaderboard. Run it, screenshot your number, and drop it in the comments — I genuinely want to see who's burning the most. 🔥

It's free: no account, no upsell, nothing to log in to. Happy to answer anything.

*(Not affiliated with OpenAI or Anthropic — tokmax just reads logs the tools write locally.)*

---

## 5. TOPICS / TAGS

Top 3 (PH limit), in priority order:

1. **Developer Tools**
2. **Open Source**
3. **Artificial Intelligence**

Backups for cross-tagging / if a slot frees up:
- **Command Line Tools (CLI)**
- **GitHub**
- **Productivity**

---

## 6. GALLERY SHOT-LIST (3–5 assets)

1. **Hero terminal (the money shot)** — `npx tokmax` running in a clean terminal, ending on the big result: `~$2,870 · 3.5B tokens · ~3 weeks`. This is the thumbnail; make the number huge and legible. *(First gallery image = the PH card preview, so this one carries the launch.)*

2. **The leaderboard** — the public ranked list, nicks sorted by API-equivalent $. Show 8–10 rows so the "who burned the most" angle reads instantly.

3. **A profile page** — `tokmax.dev/<nick>` showing the per-model token breakdown and the API-equivalent ÷ subscription multiplier (illustrative: ~14× on a ≈$205/mo plan — "your usage paid back your plan 14×"; not the maker's real plan).

4. **Privacy two-column graphic** — "Stays on your machine" (prompts, code, file contents, tool output, API keys) vs "Leaves your machine" (token counts per model, dates, machine label). Same trust line as the copy. Calms the "a tool reading my logs?" reflex.

5. **GIF (10–15s)** — full flow: type `npx tokmax` → number lands → cut to the live public profile + leaderboard slot. Ends on a "screenshot this" beat.
