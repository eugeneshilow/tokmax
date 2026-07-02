# Product

tokmax has two main surfaces:

- `cli/`: the npm package. It scans local Codex and Claude Code logs, aggregates tokens, computes API-equivalent cost, and publishes the payload.
- `web/`: the Next.js and Convex app. It receives publishes, projects profiles, and renders public pages plus leaderboards.

Product principles:

- Keep the CLI dependency-light and transparent.
- Keep user-facing copy English-only.
- Preserve the privacy boundary: no prompts, code, raw logs, tool output, or API keys are transmitted.
- Store enough per-day and per-model data to support period and model-specific leaderboards.
