# tokmax — журнал решений

Append-only, **новое сверху**. Полный канон формата — в основном проекте
(`vibecoding-ru/docs/decision-log.md`). Сюда — решения и осознанные отказы по tokmax.

## 2026-07-02 · Событие Fable 5 идёт по времени Сан-Франциско; Money Terminal — на весь сайт
(1) Часы события — America/Los_Angeles: day counter и дедлайн на страницах/OG
считаются по SF («day 1/7», пока в SF 1 июля). Дни ДАННЫХ — UTC-строки дат из
логов CLI (атом, не режется), поэтому окно данных включает UTC 2026-07-08
целиком — 7 июля в SF засчитывается полностью (`FABLE5_LEADERBOARD_DATA_END`).
Публичная формулировка: «July 1-7 · San Francisco time».
Слова владельца: «время считай по Сан-Франциско! Там ещё по-моему всего 1 июля».
(2) Арт-дирекшн Money Terminal раскатан на весь сайт: JetBrains Mono как
брендовый mono (next/font), компонент `TerminalCard` (traffic lights, mono
title bar, orange edge-glow, LIVE-точка) оборачивает борды и hero-CTA; медали
топ-3 на всех бордах; hostname-лейблы на бордах заменены чипом «💻×N»
(display-слой privacy); period-пиллы борда свёрнуты до «2 месяца + год +
all-time» (dead-end пиллы — вон); double-precision числа убраны в title-тултип.
(3) Admin-хирургия: `admin_tmx:purgeSubmissionsByLabels` — точечное удаление
сабмишенов по machineLabel с ре-проекцией, НЕ трогая аккаунт/токены (в отличие
от `purgeNick`) — для миграции с сырых hostname-лейблов без пере-логина машин.
Слайс WIP Codex (фича Fable 5 + cleanup кода) зашипован с фиксами поверх:
(1) event-борд фильтрует по window-scoped `fable5Suspicious` (кап $7,500 на
окно 1–7 июля), а не по all-time `suspicious` — иначе lifetime-киты >$15k
невидимы на борде; (2) `machineLabel` по умолчанию = `machine-<sha256[:6]>`,
сырой hostname больше не покидает машину (privacy-клейм стал правдой);
(3) `GLOBAL_DAILY_CAP` 5000→20000 на окно запуска; (4) дивергенс-гейт
`dailyModelSpend` сравнивается с одинаково усечённым `dailySum`, не с all-time
totals (убирает авто-suspicious тяжёлых юзеров); (5) усечение per-day массивов
держит свежайшие дни, не старейшие; (6) `isFable5ModelId` ловит
Bedrock/Vertex/router-префиксы; (7) share-строка + `x.com/intent` в CLI после
publish; (8) OG-image борда fable-5 c empty-state и countdown. RU-комменты
HARDENING в слайсе заменены английскими (cleanup Codex): полные обоснования —
в git history до `55923be` и в `docs/2-product/methodology/findings-log.md`.
Отвергли: мерж WIP одним блобом (docs-gutting отложен решением владельца).

## 2026-07-01 · Решения сессии Codex (перенос из его EN-rewrite, канон — здесь)
(1) `AGENTS.md` tokmax — local-only, в git не живёт (`.gitignore`);
(2) публичные контакты — только X владельца и GitHub-репо; (3) лидерборд
запуска Fable 5 зафиксирован на 1–7 июля 2026; (4) CLI шлёт per-day per-model
spend, чтобы fixed-window борды не считали старое использование.

## 2026-07-02 · Арт-дирекшн «Money Terminal» — канон визуального языка
Каждый share-артефакт — фейковый скриншот терминала (traffic-light точки,
`$ npx tokmax`, box-drawing, гигантское оранжевое число) + оранжевый edge-glow
+ flame-tier глиф; палитра ink/burn/profit/codex, Inter + JetBrains Mono;
CLI = сайт = OG pixel-for-pixel. Спека и мокапы —
`docs/1-strategy/fable5-summaries/style-virality-2026-07-02.md`.
Слова владельца (про terminal-card мокап): «вот это выглядит ОХУЕННО!»
Отвергли: «receipt/invoice» (заезжен Receiptify; остаётся как разовый
event-skin), «burn meter» (🔥 = generic AI-twitter, не несёт профит-сюжет).

## 2026-07-02 · Папка fable5-summaries — дневник мышления модели в docs
В tokmax (как и в vibecoding-ru, vibecoding-tech) живёт
`docs/1-strategy/fable5-summaries/`: агент сохраняет туда промежуточные
размышления, выводы и спеки крупных прогонов тем же заходом. Канон правила —
`AGENTS.md` основного проекта `vibecoding-ru` (Docs → Fable5-summaries).

## 2026-06-28 · Подсчёт $: ccusage (счёт) + LiteLLM (цены) + НАША формула; Convex не считает
Движок «API-equivalent $»: токены — методологией ccusage (дедуп `message.id+requestId`,
max-wins); цены — из LiteLLM (maintained, не руками); формула — **наша** (правильный дисконт
cache-read ~10×). **ccusage-$ напрямую НЕ берём** — он завышает Codex (cache-read по полной
input-ставке, ~2.4× на cache-heavy). Convex ничего не пересчитывает — хранит/показывает
клиентское число (⇒ верификация = отдельный, ещё открытый gate). Атрибуция: «prices: LiteLLM ·
counting: ccusage». Канон — `docs/2-product/methodology/`, лог находок — `methodology/findings-log.md`.

## 2026-06-28 · Методология мейнтейнится в ДВУХ местах — цифры обязаны биться
`vibecoding.ru/tokenmaxxing` (RU-витрина) и `tokmax` (intl) делят один движок счёта/цен → на
одних и тех же логах числа должны совпадать. Это текущий **cross-reference-check** корректности;
разошлись — баг в одной из реализаций общего канона.

## 2026-06-28 · РУ/EN — маховик, не противостояние
Принцип, снявший вечный «vs»: один движок (экспертиза + аудитория, языко-независимы) → два
выхлопа (РУ-контент, EN-тулзы), кросс-кормят. **Закон:** каждая работа отбрасывает топливо
другому фронту; одна история — два языка. **Гейт:** synergy-чеклист — «как ОНО кормит второй
фронт?», не можешь ответить → переделай. tokmax — эталон: воронка→РУ-трафик, build-in-public→
РУ-контент, методология→РУ-бенчмарк, охват→соцпруф, РУ-фидбэк→лучше тула. Полная версия —
память агента `ru-en-split-resolution`.

## 2026-06-28 · Международный лонч — продукт-лед, не бренд-лед
tokmax выходит на запад как **артефакт** (PH / Show HN / Reddit / Twitter), а не как
стартап/личный бренд. Паспорт, кредлы, VC не нужны (это «игра Б»). Личный бренд остаётся
в РУ. **Почему:** язык-нейтральная тула едет на пользе, а не на лице фаундера; западные
discovery-площадки не спрашивают, кто ты и откуда; международный успех бустит ру-кред.

## 2026-06-28 · docs зеркалят основной проект (4 слоя)
Структура `docs/` (1-strategy … 4-operations) повторяет vibecoding-ru — одинаковая
навигация во всех проектах. Лонч живёт в `3-marketing/launch/` (go-to-market = маркетинг),
без отдельного top-level `launch/`.

## 2026-06-27 · Canonical-домен = tokmax.vibecoding.tech (international)
Служёный канон — нейтральный `.tech`, не `.ru` (чтобы не отпугивать западных девов
оптикой санкций). `tokmax.ru` / `www` / `tokenmax.ru` → редиректы. `vibecoding.tech` apex
→ 307 на tokmax.vibecoding.tech (пока).

## 2026-06-27 · npm-команда = tokmax (geo-нейтральная)
Гео живёт в домене, не в команде. «-ru» пугает и западных (санкции), и русских
(бан-паранойя). Все будущие npm-пакеты — тем же принципом.

## 2026-06-27 · Изоляция от основного сайта
Публичный анонимный write-endpoint вынесен в отдельные Convex/Vercel/репо — не делит
инфру (concurrency/billing) с vibecoding.ru. Причина из security-аудита.
