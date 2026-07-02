# tokmax — Style × Virality: "Money Terminal" art direction — 2026-07-02

Date: 2026-07-02. Status: spec (dated artifact); the art direction was
canonized by the owner — entry in [`../../decision-log.md`](../../decision-log.md).
Result of the second multi-agent run (5 auditors: design code, visual critique
of live screenshots, viral surfaces, market references, share loop; synthesis;
mockups; critic — fixes baked in). Thesis: every styled surface exists to be
screenshotted; every viral mechanic must look on-brand.

## 1. Verdict

The two strongest assets — the green PROFIT block ("+$8,349 · 21.9×", the only
non-template element, 9/10) and the profile OG with the giant orange number —
**are not wired to the moments of distribution**: the terminal output (the
dopamine peak, the thing people actually screenshot) looks like apt-get
(3/10); the event board is a 404; the board and the landing page share with an
empty card (no OG); the board exposes raw hostnames. The style lives in
copy-pasted className: 9 grays, 6 greens, a dead CSS layer, system mono — the
face of a terminal brand renders differently on every OS.

## 2. Art direction: "Money Terminal"

**Metaphor**: every share artifact is a fake terminal screenshot:
traffic-light dots, a `$ npx tokmax` line, a giant orange number inside. The
audience already posts terminals voluntarily (ccusage culture) — we make "what
they already post anyway", but unmistakably on-brand. CLI = site = OG,
pixel-for-pixel.

**Palette** (pin in `@theme`, remove the dead Apple block
`globals.css:84-138`):

```text
ink     #070707   background     surface #111111
paper   #F5F5F7   light data sections
burn    #FF7A1A   money and brand — this only
profit  #18D86B   strictly CLI/profit (not boards)
codex   #3861FB   Codex in charts only
lines   #242428 / #D2D2D7 · text: exactly 3 grays: #D2D2D7 / #A1A1A6 / #6E6E73
```

**Typography**: Inter (text, tabular-nums everywhere) + JetBrains Mono 400/700
via next/font (+ a mono woff in the OG renderer, otherwise the cards stay
off-brand). One h1 ramp 42/60/76, eyebrow mono 11px / tracking 0.08em,
display leading 0.92 (kill 0.85 — it clips `$`).

**Signature feed device**: an orange edge glow around the perimeter of the
dark card (otherwise it drowns in a dark-mode feed) + a flame-tier glyph next
to the number (the heat grows with spend). The silhouette stays constant, like
monkeytype's result screen.

**Why it hits**: viberank is generic dark SaaS with no economic narrative. Our
lane: Bloomberg discipline of "orange numbers on black" + `21.9×` as the
emotional hero — the story of "I beat my subscription".

**Rejected**: "receipt/invoice" — worn out by Receiptify, a second visual
language; kept as a one-off event skin. "Burn meter" — 🔥 is generic
AI-twitter and carries no profit story; only the glyph survives.

**Mockups** (visual spec, open in a browser): [mockups/og-profile.html](mockups/og-profile.html)
(1200×630), [mockups/og-event.html](mockups/og-event.html) (1200×630),
[mockups/terminal-card.html](mockups/terminal-card.html) (~800px).
The owner approved the terminal-card verbatim: "looks F*CKING AWESOME"
(«выглядит ОХУЕННО», in Russian).

## 3. Viral surfaces (ranked)

X-2026 context: links in posts are throttled (−30–50% reach) → **primary =
a native PNG in the post, link in the first reply**; OG is the second tier.
Profiles are `noindex` → cards = the only discovery channel.

| # | Surface | What to do | ROI | Effort | When |
|---|---|---|---|---|---|
| 1 | OG fable-5 + /leaderboard + / | Parameterize `[nick]/opengraph-image.tsx`: top 3, medals, total, days left, **empty state** | max | S | today |
| 2 | Terminal receipt (CLI) | Box frame, orange `$X`, green `+$Y · ×`, `🏆 #N` (rank in publish response — `web/convex/http.ts:366`), paste-ready tweet + intent; share line — in 0.9.11 today, box receipt — 0.9.12 | high | M | week |
| 3 | Share intents on the profile | `Share on X` + "Copy my stats" instead of the passive "↓ screenshot this" | high | XS | week |
| 4 | PROFIT block | URL on the bottom edge of the block (page + OG) — crop-proof attribution | mid | XS | week |
| 5 | Event countdown | "FABLE 5 · ends July 7 · Xd left" on landing/board/profiles; urgency is currently 0 | high | S | week |
| 6 | Board rows | Fable-5 medals (`fable-5/page.tsx:92`), hostname → a "💻×2" chip (`leaderboard/page.tsx:227`) + a CLI-side hash at submit | mid | S | week |
| 7 | Wrapped card | Event finale: total + rank + peak day; fields in `lib/tmx-profile-live.ts:56-59`; publish on the morning of the 8th | high | M | July 8 |
| 8 | `/[nick]/card.png` | 16:9 PNG endpoint + "copy image" for the screenshot-first mechanic | high | M | later |
| 9 | GitHub badge SVG | `/badge/<nick>.svg` — permanent backlinks from READMEs | mid | S | later |
| 10 | Profile OG polish | Remove the duplicated domain, 9.25B instead of 10 digits, 44px nickname + avatar | mid | S | later |

Also during event week: a live number in the landing hero (right now the first
screen has zero digits — the acquisition surface of the week), one
`$ npx tokmax [Copy]` instead of three repeats, fix the double precision
(`$8,749 + $8,748.65` in one cell reads as a bug), the `tokenmax` typo
(`[nick]/page.tsx:649`), a decision on the boards' color semantics (green
entry buttons vs "green = profit only" — recolor or legitimize as an event
skin, don't leave the contradiction), collapse the 9 period pills to
July · All-time (the rest are "No one on the board" dead ends).

## 4. Share loop — top 5 fixes

1. **Deploy the WIP** — the board is a 404, old publishes without
   `dailyModelSpend` don't count → post "re-run `npx tokmax`".
2. **Share moment in the terminal** — after `Done! Your page:`
   (`cli/bin/tokmax.mjs:826`): a ready tweet + intent; move the multi-machine
   block (`:834-845`) down.
3. **Profile as a share console** — an intent button in the actions row
   (`[nick]/page.tsx:425-435`), copy-on-click on the hero and the shareUrl
   chip: 6 manual actions → 1 click.
4. **Wow number before questions** — reorder `main()` (`tokmax.mjs:963-986`):
   scan → `You burned $X` within ~10s → identity/publish; dedup the period
   question (`:422` vs `:653`).
5. **Countdown banner + fable-5 OG** — gives a cold visitor a reason to act
   today.

## 5. Order of work

Stage 0 (ship the Codex WIP) comes first, as in
[improvement-plan-2026-07-02.md](improvement-plan-2026-07-02.md) §5; then:
until July 7 — only what multiplies shares within the window (§3 "today/week"
+ the share loop); on the morning of the 8th — wrapped; after the event — the
style foundation: the palette in `@theme` + removal of ~330 dead CSS lines,
6 UI primitives (Badge/Pill/Btn/Eyebrow/SectionHeader/DataTable), JetBrains
Mono, one type ramp and container, a shared header/wordmark (the logo
currently renders three different ways, and mobile has no way back), color
semantics, the radius rule "data sharp, controls rounded-lg, pills full";
then card.png, badge SVG, the profile diet (30 daily rows → stacked chart,
~4700px → ~2500px).

The logic: the systemic style refactor is deliberately after the event, but
mandatory — otherwise every new viral artifact forks drifting copy-paste
instead of a single brand.
