# tokmax — unified improvement plan — 2026-07-02

Date: 2026-07-02. Status: research report + plan (dated artifact).
Result of a Fable 5 multi-agent run (11 agents: CLI, web, Convex, docs,
Codex WIP diff, market/X; 3 planners; synthesis; critic — its fixes baked in).
The owner approved the plan ("broadly agree"). Decisions made during execution
go to [`../../decision-log.md`](../../decision-log.md).

## 1. Where we are now — honestly

The product works: CLI v0.9.9 on npm, the site is live, the owner's profile
shows $8.7k / 9.25B tokens, the "21.9×" PROFIT block is the strongest
screenshot in the niche. But **the Fable 5 event is underway (July 1–7, today
is day 2), and its board is a 404 in prod**: the whole feature
(CLI 0.9.11 + Convex schema + `/leaderboard/fable-5`) sits as uncommitted
Codex WIP in a dirty worktree, the page is untracked. The news window is
perfect: Fable 5 came back on July 1 after 19 days offline, Anthropic's 50%
limit expires July 7. Competitors: viberank (896 users, $3.3M) publicly burned
on inflated numbers — the "verified + receipts" niche is open; claudecount
(X-OAuth) is dead.

Trust traps: the copy lies with "server recomputes the $" (the server is a
dumb store), `machineLabel = os.hostname()` goes public despite the promise
"only numbers leave your machine", zero tests on the money math, LiteLLM is
not pinned to a commit SHA despite the "pinned rates" claim.

## 2. Fable 5 event (July 1–7 window)

### Ship day (July 2, first ~6 hours)

1. **Verify which Convex deployment is prod** (`.env.local` points to dev
   `chatty-boar-479`, `NEXT_PUBLIC_CONVEX_URL` — `gallant-wildcat-346`).
   Pushing the schema to the wrong one = 500 on publish on launch day.
2. **Triage the Codex WIP** into ship / revert / hold (see §5, stage 0).
3. Pre-deploy fixes (≤1.5h, in the same slice):
   - `isFable5ModelId` does not catch `anthropic.claude-fable-5-*`
     (Bedrock/Vertex → $0);
   - the 120-day slice in `web/convex/http.ts:190,201` keeps the **oldest**
     days → heavy users lose July and get auto-flagged suspicious;
     keep the newest;
   - **the $15k suspicious gate is all-time, not window-scoped** → a whale
     with lifetime >$15k is invisible on the event board; breaks whale
     recruiting (viberank's top is $80k);
   - `machineLabel` → generic/hash (raw hostname is the most quotable dunk);
   - restore the RU profanity list in nickname moderation (Codex removed it
     needlessly);
   - **OG image for `/leaderboard/fable-5`** with an **empty state** (July
     1–2 publishes don't count — they need `dailyModelSpend` from CLI ≥0.9.10;
     the board is empty at deploy time). The OG does NOT wait for
     rank-in-publish-response — false dependency;
   - **paste-ready share line in CLI 0.9.11 — today, not 0.9.12**: a ready
     tweet with numbers + `x.com/intent` after `Done! Your page:`
     (`cli/bin/tokmax.mjs:826`). Peak runs come with the re-run wave; there
     will be no second re-run this week.
4. Deploy strictly: **Convex prod → Vercel → `npm publish` 0.9.11**.
5. `GLOBAL_DAILY_CAP` 5000 → ~20k (`web/convex/lib/tmx.ts:248`) — otherwise
   the platform rate-limits at the peak.
6. Owner: `npx tokmax` on both machines → launch thread.

### Launch thread (EN, @shilovtech)

```text
1/ Fable 5 is back after 19 days offline. Anthropic capped it at 50% of your
   weekly limit through July 7. So we built a scoreboard: who can burn the
   most anyway. Live board, 5 days left → [link]
2/ 30 seconds to enter: npx tokmax → sign in with X → publish. Your rank
   links to your X profile — climbing the board earns followers.
3/ Privacy: only aggregates leave your machine — token counts, days, dollars.
   No prompts, no file paths. Open source — read the code. [repo]
4/ Counting: ccusage methodology, deduped. Pricing: LiteLLM rates, computed
   locally by open-source code. The $ is API-equivalent — we know you're on
   Max. That's the point.
5/ Prizes: #1 verified gets pinned on this account through July + Launch
   Champion on their profile. Verified only — verification is the anti-cheat.
6/ #1 right now is $___. That will not survive the day. [board]
```

As a separate post — the owner's own flex with a PROFIT block screenshot
(self-doxxing first legitimizes everyone else's). Badges don't exist as a
feature — "Launch Champion" is applied by hand; don't promise "permanent"
while the feature doesn't exist.

### Content July 3–8 (minimum daily kit for solo)

Mandatory minimum: one standings post per day + replies to direct mentions.
Replies to the X search "Fable 5" ("put it on the board: `npx tokmax`")
— as many as time allows, first thing to cut.

- **Jul 3** — standings + tag the leaders (their RTs) + poll "rationing /
  tokenmaxing anyway / back on Opus / API key".
- **Jul 4** — meme "burning tokens, not fireworks 🎆" + feature drop.
- **Jul 5** — controversy: "The board isn't the waste — the board is the
  receipt" (angry quote-RTs carry the link).
- **Jul 6** — displacement bait: "@#2 is $[gap] behind @#1 with 36h left".
- **Jul 7** — AM "FINAL DAY", PM "⚠️ Days are UTC. The board only counts what
  you PUBLISH — re-run before 23:59 UTC". **There is no freeze mechanic** —
  the filter is date-based: publishing on July 8–9 with July days moves the
  board retroactively. Decide before the 7th: publish-time cutoff / a "final
  as of…" snapshot / honest wording. On the evening of the 7th — teaser only.
- **Jul 8 morning, once the window closes** — wrapped thread (pin it): winner,
  top 10 with tags, weird stats, tag @AnthropicAI without asking for anything,
  closer "Every major model launch gets a launch-week board".

Whale recruiting: Geoffrey Huntley (board flexer), heavy CC posters;
Simon Willison — his $110.42 was June 9, **outside the window** → frame it as
"do it again this week", not "you're already top 3" (tokmax has no data until
a person runs the CLI themselves). Always "claim your handle", never
"please promote".

## 3. Product by front (top 5 per front, ranked)

**CLI**: 1) scan-first flow — $ before identity questions; `tokmax stats`
local-only (week); 2) fix the daily-job npx cache path — it dies silently,
the board goes stale; wrapper `npx -y tokmax@latest publish` (week,
retention-critical); 3) screenshot-grade terminal card (week/next);
4) Codex dedup + an "estimated" marker on fallback pricing + `[1m]`
long-context premium (next); 5) Gemini CLI / OpenCode / Amp adapters —
~100 LOC each = a separate announcement post (next). Plus: device-code/SSH
login fallback (the README sells "laptop and server", X login over SSH is
broken — loopback on remote, silent timeout; at minimum an anon `--key` hint);
small stuff: `--since all` is broken with persistent trim, `--dry-run`
mutates prefs.

**Web**: 1) OG images for fable-5/leaderboard/landing (week); 2) countdown +
medals + follow-back `x.com/{nick}` + share intent (week); 3) ISR 30–60s on
the boards + a rank chip without fetching the top 200 (week/next);
4) `modelSpend` render, Fable-5 profile block, streaks/Δ-rank (next);
5) SEO package: remove `noindex` from profiles (it kills long-tail), favicon,
sitemap, robots, ItemList JSON-LD (next). Later: dead CSS (~70% of
globals.css), shared header, mobile.

**Backend + anti-cheat**: 1) server-side plausibility recompute (tokens ×
a server-side price table → flag on mismatch) — closes "curl $14,900" and
makes the claim honest (week/next, do first); 2) verified-only event board +
manual review of the top 10 daily (week, policy, 0 code); 3) XFF-append +
`TMX_IP_SALT` in prod (week, minutes); 4) throttling publish/xAuth failures
(cost-DoS is free right now) + sharding `ops_tmx_counters` (next);
5) deletion completeness (purge by `x_user_id`) + precomputed aggregates
instead of a 1000-doc scan (next).

**Docs + marketing**: 1) **P0, blocks posting**: kill "server recomputes" in
all assets, refresh the numbers, honest payload + disclose plan detection
(week); 2) event content: standings, winner, wrapped (week); 3) Codex
docs-gutting: canon is **archive, don't delete** — the findings log is the HN
defense of the math (week); 4) pin the LiteLLM commit SHA + PROFIT/×
methodology (rolling-30, price staleness, elasticity caveat) + PH gallery
assets — the folder is empty, no PH launch without them (next);
5) metrics/funnel + the event runbook as a reusable format (next).

**Tests (cross-cutting, next)**: zero tests on the public board arithmetic —
aggregate, pricing, Codex split, dedup, window math. "Unaudited numbers" is
the cheapest dunk; the only insurance when adding adapters.

## 4. Strategy

**Position: "verified token-burn scoreboard — X identity, receipts, event
boards"**, not "yet another spend tracker". Three claims: verified people
(rank = follower faucet); PROFIT/× flips "wasteful" into a value hack;
receipts (open source, dated windows, per-model) — the claim must become true
(recompute). "Every model launch = a launch-week board" is a franchise nobody
else has.

**Retention**: `daily on` is the only mechanic, and it's broken (npx path);
the fix matters more than any new feature. Monthly seasons + a winner post on
the 1st; streaks (the data is in `daily[]`).

**Metrics**: north star — **Weekly Active Publishers**. Supporting:
% verified among WAP; npm downloads → first publish; `daily on` adoption /
stale rate. Anti-metric: raw "$X tracked" (viberank's is inflated by fraud).

**Risks**: a fraud scandal mid-event (mitigation: verified policy + recompute
+ manual review + a prepared transparency post); Anthropic optics ("measure
what you got", not "drain your limits"; post Codex numbers too); privacy dunks
(hostname, plan detection) — fix before inviting an audit.

**What NOT to do**: HN/PH/Reddit during event week (Show HN after the 7th
with the week's data); cash/crypto prizes (they move fraud from ego to money;
at most a month of Max); adapters during event week; cross-selling the RU
course on tokmax; expanding the X scope beyond read.

## 5. Order of work

- **Stage 0 (blocks everything)**: cut the Codex WIP apart, don't merge it as
  a blob: **(a) ship** — the Fable-5 vertical slice (cli pricing/payload,
  convex schema/http/tables, `tmx-profile-live.ts`, the untracked page —
  `git add` immediately) + the §2 pre-fixes; **(b) revert** — the removal of
  the RU profanity list; **(c) hold** — docs-gutting + AGENTS.md deletion →
  separately, owner's decision, canon goes to the archive. Slice (a) also
  silently removes the RU comments with the HARDENING/P0 rationales in the
  code — record the rationale in the decision-log in the same pass.
  Deploy: verify prod → Convex → Vercel → npm.
- **Stage 1 (today)**: both of the owner's `npx tokmax` runs → launch thread
  → cap ↑.
- **Stage 2 (24h)**: countdown/medals → share intent → follow-back → CLI rank
  → honest copy. Cut from the week: podium cards with X-follow icons, profile
  OG polish → after the event.
- **Stage 3 (48h)**: daily-job fix → ISR → XFF/`TMX_IP_SALT` → reserved nicks
  (~20 known handles, **with an exception for the verified owner of the
  handle** — otherwise we lock the door on the very people we're inviting) →
  landing banner → decision on the freeze mechanic. Content minimum in
  parallel.
- **Stage 4 (trust)**: recompute → verified policy → manual review of the
  top 10.
- **Stage 5 (from July 8)**: wrapped → money-math tests + CI → Show HN →
  adapters one at a time → methodology + PH assets → seasons/streaks.

Dependencies: everything hangs on stage 0; link posting on OG + honest copy;
Show HN on recompute; adapters on tests.
