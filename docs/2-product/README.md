# 2 — Продукт (сам tokmax)

Дом для: **как устроена тула** — что и как она считает и показывает.

- **CLI** (`cli/`, npm-пакет `tokmax`): `npx tokmax` → онбординг (ник + как считать),
  адаптеры логов Codex (`~/.codex/sessions`) и Claude Code (`~/.claude*/projects`),
  дедуп по `message.id`, превью по той же формуле, что и сервер.
- **Методология $** — отдельный канон: [methodology/](methodology/README.md). Кратко: токены
  считаем как ccusage (дедуп), цены из LiteLLM (maintained), формула наша (дисконт cache-read),
  Convex НЕ пересчитывает. Лог косяков/находок — [methodology/findings-log.md](methodology/findings-log.md).
- **Web/лидерборд** (`web/`, Next + Convex): публичная страница профиля
  `tokmax.vibecoding.tech/<nick>`, event-sourcing (data_raw → projector → data_cooked).
- **Данные**: схема в `web/convex/schema.ts` (source of truth).

Этот слой — про продукт; деплой/безопасность/домены — в [4-operations](../4-operations/README.md).
