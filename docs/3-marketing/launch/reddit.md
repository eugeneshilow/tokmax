> PRE-FLIGHT (delete before posting): (1) Swap every `<nick>` for your real profile URL. (2) Post on **different days** — three near-identical posts from one account on the same day trips Reddit's spam filter. (3) Check each sub's sidebar for required flair (e.g. "I made this" / "Self-promotion" / "Showcase") — missing flair = instant removal. (4) Be in the comments in the first hour; expect "does it really only send counts?" and answer it fast. (5) `github.com` is the trust link — keep the repo link in the body; the `.tech` product domain is more likely to be filtered.

---

## 1) r/ClaudeAI

**TITLE:**
I built a free tool that shows what your Claude Code usage would've cost at API prices. Mine: ~$2,870 · 3.5B tokens · ~3 weeks.

**BODY:**
I'm on a flat subscription, and I got curious: what would that same usage cost if I paid per-token at API rates instead?

So I wrote `tokmax`. One command, nothing to install:

```
npx tokmax
```

It reads your local Claude Code logs (and Codex too, if you use it), counts tokens per model, and computes the "API-equivalent $" — what your burn would've cost at public per-model API rates.

My number: **~$2,870 · 3.5B tokens · ~3 weeks** of API-equivalent tokens. Made the subscription feel like a steal.

It publishes a small profile to a public leaderboard so you can compare. Mine: tokmax.dev/<nick>

Privacy, because a tool that reads your logs *should* make you suspicious:
- Only aggregates leave your machine: token **counts** per model, dates, and a machine label.
- Never your prompts, code, file contents, tool output, or API keys.
- Open source — read it before you run it: github.com/eugeneshilow/tokmax
- The server recomputes the $ from the counts using public rates, and the methodology dedupes session resumes so nothing's double-counted.

Disclosure: I made this. Free indie thing — no signup, no account, no email to run it. Not affiliated with Anthropic.

Curious what your number is. And tell me where the methodology's wrong.

---

## 2) r/ChatGPTCoding

**TITLE:**
npx tokmax — what your Codex + Claude Code token burn would cost at API prices

**BODY:**
If you live on a Codex or Claude Code subscription, you've probably wondered what all that usage would actually cost per-token at API rates.

`tokmax` answers that. One command:

```
npx tokmax
```

It scans your local Codex and Claude Code logs, counts tokens per model, and shows your "API-equivalent $" — your usage repriced at public API rates. No install, no signup, no account, no email.

Enter your $/mo subscription and it also shows how many times over your usage paid the subscription back (**API-equivalent ÷ subscription = N×**).

My run: **~$2,870 · 3.5B tokens · ~3 weeks** of API-equivalent usage. There's a public leaderboard if you want to compare burn.

Privacy, since it reads your logs:
- Only aggregates are sent: token counts per model, dates, a machine label.
- Never your prompts, code, file contents, tool output, or API keys.
- Open source: github.com/eugeneshilow/tokmax — the server recomputes the $ from the counts using public rates, and the methodology dedupes session resumes.

Disclosure: I built it. Free, indie, build-in-public. Not affiliated with OpenAI or Anthropic.

Feedback welcome — especially if the per-model rates or the dedup logic look off to you.

---

## 3) r/LocalLLaMA

**TITLE:**
Open-source tool to compute the API-equivalent cost of your Codex/Claude Code logs — here's exactly what leaves your machine

**BODY:**
This crowd will (correctly) interrogate any tool that reads local logs, so let me lead with the mechanics, not a number.

`tokmax` (`npx tokmax`, Node 18+, zero runtime deps, open source) parses your local Codex and Claude Code logs and computes what that usage would cost at public per-model API rates — the "API-equivalent $" of a flat subscription.

How it works:
- Parses local log files; extracts token **counts** per model + dates.
- Dedupes session resumes so the same turns aren't counted twice.
- What leaves your machine: token counts per model, dates, and a machine label. That's the entire payload.
- What never leaves: prompts, code, file contents, tool output, API keys.
- The server recomputes the $ from the submitted counts at public per-model rates, so the dollar conversion can't be fudged.
- Source: github.com/eugeneshilow/tokmax — don't take my word for it.

There's a public leaderboard and an optional **API-equivalent ÷ subscription** ratio (enter your $/mo, see how many times over your usage covered it). For context, my own run came out at ~$2,870 · 3.5B tokens · ~3 weeks of API-equivalent usage — but I'm posting *here* for the methodology, not the scoreboard.

Disclosure: I built this. Free, no account or email to run. Not affiliated with OpenAI/Anthropic.

What I'd genuinely like from this sub: tell me where the per-model rate table, the dedup, or the token accounting is wrong. If the methodology doesn't hold up here, it doesn't hold up anywhere.
