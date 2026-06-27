# 4 — Операции (чтобы работало)

Дом для: **инфра и эксплуатация.**

- **Деплой**: Convex (сейчас dev `chatty-boar-479`; прод — gate перед лончем),
  Vercel (проект `tokenmax`, фреймворк next через `vercel.json`).
- **Безопасность** публичного анонимного write-endpoint (`/api/tmx/publish`):
  kill-switch, rate-limit по ipHash, value-cap, глобальный дневной потолок,
  анти-poisoning. 3 P1 из аудита — закрыть до публичного лонча.
- **Домены/DNS**: `.tech` через Porkbun (`~/.porkbun-api`), `.ru` через reg.ru.
  Canonical `tokmax.vibecoding.tech`; редиректы `tokmax.ru`, `tokenmax.ru`,
  `vibecoding.tech` apex.
- **Монетизация** (когда дойдём): Merchant-of-Record (Paddle / Lemon Squeezy / Polar)
  + зарубежное юрлицо. Сейчас тула бесплатная.
