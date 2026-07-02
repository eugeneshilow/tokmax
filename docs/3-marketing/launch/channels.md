# Multi-channel Launch Plan — "tokenmaxxing"

Date: 2026-07-02. Status: master playbook for everything beyond X (X lives in
[x-launch.md](x-launch.md)). Executor: Codex (prep + monitoring) + owner
(account-bound submissions). Fill `$___` with live numbers at post time.

## The narrative (same spine on every channel)

**Tokenmaxxing** — squeezing maximum value out of AI coding subscriptions.
Two sides, always both:

1. **The flex** (virality): a verified leaderboard of who burns the most —
   API-equivalent $, real X identities, launch-week event boards.
2. **The optimization** (substance): PROFIT/× (did your usage beat your
   subscription price), stack math (when a 2nd/3rd subscription pays for
   itself), per-model and per-day breakdowns — a decision aid, not a casino.

One-liner: *"tokmax measures what your AI coding would cost at API prices —
and turns tokenmaxxing into a verified sport with honest economics."*

Channel tone shifts: X = flex-first; HN = engineering + honesty-first;
PH = product-first; Reddit = community-first (value, then link).

## Sequencing (stages, not dates — except the event window)

1. **Now → Jul 7 (event window):** X only ([x-launch.md](x-launch.md)).
   No HN/PH/Reddit — they get the event's DATA as their hook. Codex preps
   all assets below during the window.
2. **Jul 8 (event close):** X wrapped thread → its numbers become the
   headline material for every other channel.
3. **Jul 9-10:** Product Hunt launch (Tue/Wed, 00:01 PT) + Show HN the same
   week but NOT the same day (each needs its own attention window).
4. **Same week:** Reddit (staggered, one sub per day), Discord/communities,
   newsletter pitches, blog post, GitHub polish + awesome-list PRs.
5. **Ongoing:** every future model launch = a new launch-week board = a new
   full cycle of this plan with fresh data.

## Channel matrix

| # | Channel | Asset | Who posts | Prep owner |
|---|---------|-------|-----------|------------|
| 1 | Product Hunt | [product-hunt.md](product-hunt.md) + gallery (5 images) | owner | Codex |
| 2 | Hacker News | [show-hn.md](show-hn.md) + comment-defense FAQ | owner | Codex |
| 3 | Reddit | [reddit.md](reddit.md) per-sub texts | owner | Codex |
| 4 | Discord/Slack communities | §Communities below | owner (paste) | Codex |
| 5 | Newsletters | §Newsletter pitches below | owner (email) | Codex |
| 6 | Blog post (dev.to + repo) | §Blog below | Codex writes, owner approves | Codex |
| 7 | GitHub surface | §GitHub below | Codex (PRs) | Codex |

## §Communities (paste-ready, adapt the greeting)

Targets: Anthropic Discord (#claude-code), Cursor Discord, Latent Space
Discord, AI Engineer communities, Codex/OpenAI dev Discord.

> We ran a 7-day leaderboard during the Fable 5 launch — who burns the most
> tokens, measured at API-equivalent prices, verified via X handles. $___
> burned across ___ devs in a week. The fun part is the flex, the useful part
> is the math: it computes whether your pace means a 2nd subscription pays
> for itself. `npx tokmax` if you want your number — only aggregates leave
> your machine, code is open: github.com/eugeneshilow/tokmax

Rules: post in show-your-project channels only; answer every reply; never
cross-post the same wording twice in one server.

## §Newsletter pitches (email/form, 60-second read)

Targets: TLDR (tldr.tech submit), Ben's Bites, Console.dev (form), Changelog
News (news@changelog.com), Latent Space.

> Subject: Tokenmaxxing — a verified leaderboard of AI coding token burn
>
> During the Claude Fable 5 launch week we ran a public experiment: a
> leaderboard of who burns the most tokens, measured at API-equivalent
> prices from local logs, identities verified via X. Results: $___ across
> ___ devs in 7 days; the average pace implied a 2nd $200 subscription pays
> back ___×. One command (`npx tokmax`), open source, only aggregate numbers
> leave the machine. Data + methodology: tokmax.dev/fable-5

## §Blog post (dev.to + docs mirror; SEO for "tokenmaxxing")

Title: **"Tokenmaxxing: the economics of stacking AI coding subscriptions"**.
Outline (Codex drafts, owner approves):

1. The 50% cap and the question everyone asked during Fable 5 week.
2. What API-equivalent measurement means (ccusage counting, LiteLLM rates,
   local computation) and what it deliberately does NOT claim.
3. The week's data: total burn, distribution, peak days, PROFIT/× spread.
4. Stack math: the formula, the capped-demand asymmetry, when a 2nd sub is
   rational, when a 3rd isn't.
5. Anti-fraud design of a self-reported leaderboard (verified handles,
   window gates, plausibility caps) — what worked, what we'd harden next.
6. CTA: `npx tokmax`, the board, the repo.

## §GitHub (Codex-executable this week)

- README: add the two receipt cards as images, "tokenmaxxing" in the
  description line, badges (npm version, MIT).
- Repo settings (owner clicks): social preview image = profile OG; topics:
  `claude`, `claude-code`, `codex`, `leaderboard`, `token-tracking`,
  `tokenmaxxing`, `cli`.
- Release v1.0.0 with the wrapped numbers in the notes.
- PRs to awesome lists: awesome-claude-code, awesome-claude, awesome-devtools
  (one-line entry, follow each list's contributing rules).

## Codex delegation brief (run post-event, one task per line)

1. Generate the PH gallery per the spec in [product-hunt.md](product-hunt.md)
   (Playwright screenshots of live surfaces at 1270×760 → Dropbox
   `6-content/vibecoding-ru/tokmax-launch/`, binaries never in git).
2. Fill every `$___` across launch docs from live prod numbers (hub + convex
   queries) on Jul 8, same pass as the wrapped thread.
3. Draft the blog post per §Blog outline into a PR (docs/3-marketing/launch/
   is its docs home; dev.to copy is owner-pasted).
4. GitHub README/release/awesome-list PRs per §GitHub.
5. Assemble the Reddit/community/newsletter texts with final numbers into a
   single paste-sheet for the owner (one message per target, ready to send).
6. Monitor launch days: watch PH comments / HN thread, draft replies from the
   FAQ in [show-hn.md](show-hn.md), surface anything spicy to the owner —
   agents draft, the owner posts.

Hard rules for the executor: no posting from owner accounts; no cash-prize
promises; every claim must match the live methodology docs; numbers only
from prod, never from memory.

## Metrics (per channel, one week after each launch)

npm installs → first-publish conversions (funnel), PH rank + follower delta,
HN points + top-comment sentiment, Reddit upvote ratio, newsletter pickups,
GitHub stars + referral traffic in Vercel analytics, and WAP (weekly active
publishers) — the north star that outlives launch spikes.
