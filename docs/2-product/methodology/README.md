# Методология подсчёта API-equivalent $ (КАНОН)

Дата: 2026-06-28 · Статус: живой канон · Дом: `docs/2-product/methodology/`

Как tokmax (и страница `vibecoding.ru/tokenmaxxing`) превращают локальные логи в число
«сколько твой usage стоил бы по ценам API». Один источник правды для обоих продуктов.
Лог находок и косяков — рядом: [findings-log.md](findings-log.md) (не переизобретать!).

## Принцип в одну строку
**Токены — локально (с дедупом) × цены — из LiteLLM ÷ по нашей формуле (с дисконтом кэша).
Сервер ничего не считает — только хранит и показывает клиентское число.**

## 1. Что считаем
Токены из локальных логов **Codex** (`~/.codex/sessions/**`) и **Claude Code**
(`~/.claude*/projects/**/*.jsonl`). Пять типов: input, output, cacheCreate, cacheRead,
reasoning. Наружу уходят только агрегаты-числа — ни кода, ни промптов, ни ключей.

## 2. Подсчёт токенов — как ccusage
Берём методологию [ccusage](https://github.com/ryoppippi/ccusage) (v20+, native Rust, MIT,
покрывает И Claude И Codex):
- **Дедуп: `hash(message.id + requestId)`, max-wins** (при коллизии оставляем запись с
  бóльшим итогом токенов — это финальный/полный снапшот). Записи **без `message.id` не
  дедупим** (всегда считаем). Sidechain-реплей разводим по вторичному `hash(message.id)`.
- **Зачем дедуп:** Claude Code реплеит прошлые ходы при resume/branch/continue в новые
  файлы сессий. Без дедупа — **инфляция ~2.7×**. (Codex: убрать overlap `sessions` ↔
  `archived_sessions`.)
- Наш счёт сверен с ccusage: **совпадает ±0.4%** (3.71B наши vs 3.72B ccusage, 2026-06-28).

## 3. Цены — из LiteLLM (maintained, не руками)
Источник: **`model_prices_and_context_window.json`** (BerriAI/LiteLLM, MIT, ~1.5 MB, 2918
моделей). Это та же база, что под капотом у ccusage.
- URL: `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
- **Единицы: $/токен** (НЕ за миллион). `0.000005` = $5/1M.
- Поля: `input_cost_per_token`, `output_cost_per_token`, `cache_creation_input_token_cost`,
  `cache_read_input_token_cost`. Потребление: pinned-снапшот в репо + live-refresh с TTL
  (≤24ч) + локальный override-мап для дыр.
- **Дыры (override обязателен):** `claude-3-5-haiku/sonnet` нет голых ключей (только
  провайдер-префиксные); свежие модели лагают в LiteLLM на часы/дни. Наши `gpt-5.5`
  (5/30/0.5) и `claude-opus-4-8` (5/25/6.25/0.5) — **в LiteLLM есть и совпали с нашими
  ручными ставками точь-в-точь** (поэтому переход на LiteLLM число не меняет, но впредь
  обновляет само).

## 4. Формула (наша — и она правильная)
Для каждой модели:
```
$ = (input·rIn + output·rOut + reasoning·rOut + cacheCreate·rCW + cacheRead·rCR) / 1e6
```
- **reasoning тарифицируется как output** (не задваиваем в счётчике токенов).
- **cacheCreate (Anthropic)** = 1.25×input; **cacheRead** = 0.1×input (если в LiteLLM нет
  явного поля — берём эти коэффициенты). OpenAI: отдельной платы за cache-write нет,
  cacheRead дисконтирован.
- ⚠️ **КРИТИЧНО — cache-read ОБЯЗАТЕЛЬНО дисконтировать (~10×).** Это смысл кэша. См.
  findings-log: ccusage на Codex этого НЕ делает и завышает. Наша формула — верная.

## 5. Честность и пределы
- **Числа клиентские.** Сервер (Convex) их не пересчитывает — только хранит/показывает.
  Значит борд доверяет клиенту → **верификация = отдельный, ещё не закрытый gate** перед
  широким лончем.
- Цены могут протухнуть между обновлениями LiteLLM → версионируем (`pricingVersion`/дата).
- Свежие модели до попадания в LiteLLM считаются по override (наша оценка).

## 6. Атрибуция (и это даёт кредибилити)
Под капотом честно используем чужой maintained-труд — указываем везде (футер страницы,
README, npm):
- **Prices: LiteLLM** (`BerriAI/litellm`, MIT).
- **Counting methodology: ccusage** (`ryoppippi/ccusage`, MIT).

## 7. Кросс-референс: ДВА места, цифры обязаны биться
Методологию (этот канон) мейнтейним в двух продуктах одновременно:
1. **`vibecoding.ru/tokenmaxxing`** — RU-витрина (личная страница владельца).
2. **`tokmax`** (`tokmax.vibecoding.tech`) — отдельный интернейшнл-продукт.

У них **общий движок счёта/цен** → на одних и тех же входных логах **числа должны
совпадать**. Это наш текущий cross-reference-check корректности.
- Эталон-сверка: `npx ccusage@latest claude daily --json` + `codex daily --json` →
  токены сверяем 1:1; $ сверяем по нашей формуле (с дисконтом cache), НЕ по ccusage-$
  (он на Codex врёт).
- Если две витрины разошлись — баг в одной из реализаций общего канона; чинить до уровня
  этого дока.
