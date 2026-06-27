# tokenmax

Публичный счётчик token-maxing: сколько ценности по API-расценкам выжато из
локальных AI-coding агентов (Codex, Claude Code). Изолированный продукт линейки
**vibecoding.ru**.

- `cli/` — open-source CLI `tokmax` (`npx tokmax <ник>`):
  читает локальные JSONL-логи, считает агрегаты, публикует. Наружу — только числа,
  никогда не сырые логи или ключи.
- `web/` — Next + Convex: публичные дашборды `tokenmax.vibecoding.ru/<ник>`,
  leaderboard, ingest-эндпоинт. Отдельный Convex-проект, изолированный от
  основного сайта.

Дашборд: https://tokenmax.vibecoding.ru
