## tokmax — launch thread (build-in-public)

**Thread (7 tweets)**

---

**1/**
I ran a script on my own Codex + Claude Code logs.

~$2,870 · 3.5B tokens · ~3 weeks. That's what my tokens would've cost at API prices.

I'm on flat subs, so I paid a fraction of that. But the number stuck with me.

So I open-sourced the script. 🧵

---

**2/**
It's one command:

npx tokmax

Node 18+, zero install, zero deps. It scans your LOCAL Codex + Claude Code logs, counts tokens per model, and works out the API-equivalent $ — what a pay-per-token bill would've looked like.

Then it hands you a shareable profile page.

---

**3/**
Before you panic about a tool reading your logs:

Only aggregates leave your machine — token counts per model, dates, a machine label.

Never your prompts. Never your code. Never file contents, tool output, or API keys.

It's open source. Read it before you run it.

---

**4/**
The math is honest:

— it dedupes session resumes, so nothing's double-counted
— the server recomputes the $ from your token counts at public per-model rates, so the conversion can't be fudged

Optional: add your $/mo sub and see how many times over your usage paid it back (API-equivalent ÷ subscription = N×).

---

**5/**
And yes, there's a leaderboard.

Every profile is public, so you can see who's burning the most. I'm sitting at ~$2,870 right now — and I'd genuinely love to get dethroned.

Run it and find out where you land.

---

**6/**
Try it:

npx tokmax

No signup. No account. No email. Free.

Run it, then reply with your number. I want to see how unhinged this community actually is. 👀

---

**7/**
Built solo, in a few evenings. Not a startup, no roadmap I'm promising — just a script I thought was funny enough to share.

Code's here, PRs and roast-my-code welcome: github.com/eugeneshilow/tokmax

(Not affiliated with OpenAI or Anthropic.)

---

## Alternative hook tweets (swap in for 1/)

**Alt A**
My AI-coding 'bill' for the last 3 weeks: ~$2,870 · 3.5B tokens · ~3 weeks.

I didn't pay it — I'm on flat subscriptions. That's just what my tokens would cost at API prices.

I built a tool so you can check your own number: npx tokmax 🧵

**Alt B**
3.5B tokens in ~3 weeks. ~$2,870 if I'd been billed at API rates.

I'm either very productive or very sick. Probably both.

npx tokmax tells you your number. 🧵

**Alt C**
I got curious what my Codex + Claude Code habit actually 'costs', so I added up the tokens at API prices.

~$2,870 · 3.5B tokens · ~3 weeks.

Flat subs saved me a fortune. There's now a one-liner to check yours: npx tokmax 🧵
