# Decision Log

Append short product and engineering decisions here. Newest section on top.

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
