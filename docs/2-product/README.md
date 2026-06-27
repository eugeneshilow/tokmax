# 2 — Продукт (сам tokmax)

Дом для: **как устроена тула** — что и как она считает и показывает.

- **CLI** (`cli/`, npm-пакет `tokmax`): `npx tokmax` → онбординг (ник + как считать),
  адаптеры логов Codex (`~/.codex/sessions`) и Claude Code (`~/.claude*/projects`),
  дедуп по `message.id`, превью по той же формуле, что и сервер.
- **Методология $**: API-equivalent — токены × per-million ставки модели (`web/convex/lib`).
  Сервер пересчитывает авторитетно из присланных токенов.
- **Web/лидерборд** (`web/`, Next + Convex): публичная страница профиля
  `tokmax.vibecoding.tech/<nick>`, event-sourcing (data_raw → projector → data_cooked).
- **Данные**: схема в `web/convex/schema.ts` (source of truth).

Этот слой — про продукт; деплой/безопасность/домены — в [4-operations](../4-operations/README.md).
