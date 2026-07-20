# Decision Log

Append short product and engineering decisions here. Newest section on top.

## 2026-07-20 — PROFIT/× removed from every surface (0.9.20)

- Owner verdict: "мы неверно это все считаем — и посчитать это все очень
  сложно" — the profit/× economics ("▲ +$33,966 profit · 170.8× vs your
  $200/mo plan") is dropped entirely, not fixed. The window-burn-vs-plan
  math never accounted for plan history, purchase dates, or multiple
  subscriptions, so the number was confidently wrong.
- Removed: CLI onboarding subscription question, local plan auto-detect
  (`plan.mjs` deleted), the "Last 30 days … (profit …)" terminal line,
  profit/× in both share texts (CLI + web), the green profit card on the
  profile page, and the profit badge on the OG image (falls back to
  TOKENS/PERIOD stats).
- Kept: backend schema and stored `subscriptionUsd` (facts immutable; old
  CLIs in the wild still send the field — the server keeps accepting it,
  it's just never displayed). `--sub` flag is parsed as a no-op for
  backward compat.

## 2026-07-19 — shadow machines: hostname drift double-counted whole histories (0.9.19)

- Bug: the machine label is a hostname hash, and macOS silently bumps the
  hostname on network name collisions (`MacBook-Pro-4.local` →
  `MacBook-Pro-5.local`). The same laptop then publishes under a NEW label,
  and since every submission carries full history, the whole history
  double-counts. Live damage: eugeneshilow $60,347 shown vs $36,964 real
  ("3 machines" vs 2), lomaz $40,773 vs $24,129.
- Fix (PR #40): two layers. CLI 0.9.19 pins the computed label into
  `~/.config/tokenmax/prefs.json` on first run and reuses it forever
  (prevention). The projector drops "shadow machines" at projection time:
  an older label whose non-zero days match a newer label token-for-token
  (>=80% of days, >=3 days) is the same machine pre-rename (cure — heals
  every affected profile on next projection, any CLI version). Raw
  submissions untouched: facts immutable, hygiene lives in the projector.
- Why data-matching, not name-matching: two different machines never produce
  identical per-day token totals (verified on prod: lomaz's real second
  machine had 0 matching days and survives; both shadows matched 42/43 and
  33/36 days exactly, diverging only on the partial rename-day scan).

## 2026-07-16 — pricing pins: gpt-5.6 family + claude-sonnet-5 (0.9.18)

- Bug: no override and no LiteLLM-snapshot entry for the gpt-5.6 family, so
  the longest-prefix heuristic collapsed every 5.6 variant to the `gpt-5`
  alias of gpt-5.5 ($5/$30). `gpt-5.6-luna` (real: $1/$6) was billed 5-6x
  high — ~$243 of phantom spend on the owner's profile ($303.37 shown vs
  $60.67 real). `gpt-5.6-sol` and `claude-sonnet-5` (fallback) matched the
  right $ only by coincidence.
- Fix (PR #34): explicit override pins for gpt-5.6-sol/terra/luna and
  claude-sonnet-5; same ids added to the refresh-script KEYS so future
  snapshots carry the family. Lesson: every model actually appearing in
  local logs gets an explicit pin — the prefix heuristic and the flat
  fallback are for never-seen-before ids only, not for daily drivers.
- Verified against the canon price table (`vibecoding-ru/scripts/usage-report.mjs`)
  and the live profile: machine merge is exact (Pro $22,554.02 + Air
  $7,224.42 = site $29,778.44 to the cent before the fix), and the cost
  formula reproduces every scoreboard row. Both machines reinstalled at
  0.9.18 (tarball into the global install the launchd daily job runs) and
  republished; npm registry publish of 0.9.18 is pending (owner action).

## 2026-07-09 — value cap effectively off (15k → 250k)

- The $15k plausibility cap auto-hid the owner's own profile (~$20k lifetime,
  the only profile on the board) → every leaderboard rendered empty. Owner
  call: while the board is young and empty, an invisible board hurts more
  than a poisonable one — `TMX_VALUE_CAP_USD` raised to the hard cap
  ($250k), i.e. the soft gate is effectively off.
- Known trade-off, accepted consciously: self-reported entries up to $250k
  will show publicly. Re-lower the cap (and/or build an owner unflag tool)
  once strangers start publishing.
- Same constant gates raw submissions and the cooked profile, so one change
  covers both; profiles recompute on the next publish.

## 2026-07-09 — Fable 5 Week is retired; tokmax base stays

- Owner decision: the event went stale after July 7 — remove it instead of
  freezing `/fable-5` into final results (supersedes the "freezes into final
  results" line of 2026-07-02). Removed: the `/fable-5` hub + OG image, the
  landing event strip, the leaderboard chip, the profile "fable-5 week" card,
  and the CLI's launch-board / Stack Math output (0.9.17).
- `/fable-5` and `/leaderboard/fable-5` 308-redirect to `/leaderboard` so
  shared links keep landing somewhere alive.
- Convex is untouched on purpose: `fable5*` fields, the window projector and
  `listFable5Leaderboard` keep the event's data queryable, and the
  window-board machinery is the template for the next launch-week board
  (the franchise line stands: every major model launch gets one).
- Fable 5 model pricing in the CLI stays — that's base metering, not the event.

## 2026-07-02 — Fable 5 Week is its own product entity

- Two products live here and must not blur: **tokmax** (the evergreen meter +
  boards) and **Fable 5 Week** (a time-boxed launch-week event). The frame is
  platform + seasonal event: the event nests inside tokmax (badge "a tokmax
  launch-week board" + countdown on every event surface), never the other way
  around; tokmax pages carry exactly ONE loud event surface (the landing strip).
- The event has two jobs: (1) flex/virality via the window board, and
  (2) **Stack Math** — a decision aid for buying a second (third, …)
  subscription: `weekly pace = window burn ÷ days elapsed × 7`,
  `2nd-sub payback = monthly pace ÷ $200` (marginal Max 20×). The honest
  asymmetry prints WITH the number: capped logs UNDERSTATE demand, so the
  stack pays back more, not less; a third sub only pays if still capped with
  two. Always labeled: API-equivalent value, not cash — not financial advice.
- The event hub lives at top-level `/fable-5` (redirect from
  `/leaderboard/fable-5`): countdown + board + Stack Math + how-to-enter;
  after July 7 it freezes into final results + the franchise line ("every
  major model launch gets a launch-week board").
- Stack Math surfaces: hub section (community + #1 pace), profile receipt
  line, CLI post-scan line (0.9.14).

## 2026-07-02 — international, English-only

- The repo and all public surfaces are English-only; the owner's RU-brand link
  (`@shilovtech`) is replaced with the international handle (`@eugeneshilow`).
- `tokmax.dev` is the public display/share domain everywhere (receipt footer,
  OG images, CLI output, READMEs, npm). It 302-redirects, path-preserving, to
  the serving host. Infra URLs stay on the serving host: `metadataBase`,
  canonical/og:url, CLI auth `WEB_BASE`, and `X_REDIRECT_URI` (registered in
  the X dev portal). Full cutover of the serving host = separate decision
  (DNS repoint + X portal update).

## 2026-07-02 — event clock, art direction, multi-machine semantics

- The Fable 5 event runs on SAN FRANCISCO time (America/Los_Angeles): day
  counter and deadline are displayed in SF time. Data days are UTC log-date
  strings (the atom, can't be split), so the data window includes UTC
  2026-07-08 in full — July 7 in SF counts entirely
  (`FABLE5_LEADERBOARD_DATA_END`). Public copy: "July 1-7 · San Francisco time".
- "Money Terminal" is the site-wide art direction: every share artifact is a
  fake terminal screenshot (traffic lights, mono title bar, orange edge-glow,
  giant two-tone ANSI-Shadow dollar art). JetBrains Mono is the brand mono via
  next/font; the ANSI art itself renders in the system mono stack (the webfont
  subset lacks box-drawing glyphs). Spec + mockups:
  `docs/1-strategy/fable5-summaries/style-virality-2026-07-02.md`.
  Rejected: receipt/invoice look (Receiptify-worn; kept as a one-off event
  skin), fire/burn-meter (generic AI-twitter, carries no profit story).
- The event board filters by window-scoped `fable5Suspicious` (cap $7,500 for
  July 1-7), not the all-time `suspicious` gate — lifetime whales stay
  eligible while their launch window is plausible.
- `machineLabel` defaults to an anonymized `machine-<sha256[:6]>`; raw
  hostnames never leave the machine (they used to leak owners' real names to
  the public board).
- Profile `subscriptionUsd` = MAX across machines' latest submissions, not
  newest-wins: machines detect their own local plans, PROFIT/× divides the
  combined burn, and one person's machines overlap on plans (same Max sub) —
  max ≈ the real monthly bill, sum would double-count.
- `admin_tmx.purgeSubmissionsByLabels` exists for surgical label migrations
  (deletes a nick's submissions by machineLabel + re-projects, account/tokens
  untouched); `recomputeProfile` recovers the account from submissions so an
  admin recompute never de-verifies a profile.
- `docs/1-strategy/fable5-summaries/` holds dated model-thinking artifacts
  (plans/specs); the rule lives in the home project's `AGENTS.md`
  (vibecoding-ru → Docs → Fable5-summaries).

## 2026-07-01

- `AGENTS.md` is local-only and ignored by git.
- Public contact links should stay limited to X and GitHub.
- Public contact links should use the owner's X profile and the GitHub repository.
- Fable 5 launch leaderboard is fixed to July 1-7, 2026.
- The CLI sends per-day per-model spend so fixed-window model boards do not count earlier usage.
