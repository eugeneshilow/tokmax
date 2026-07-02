# tokmax — единый план прокачки — 2026-07-02

Дата: 2026-07-02. Статус: ресёрч-отчёт + план (датированный артефакт).
Итог мульти-агентного прогона Fable 5 (11 агентов: CLI, web, Convex, доки,
WIP-дифф Codex, рынок/X; 3 планировщика; синтез; критик — его поправки вшиты).
Владелец план одобрил («в целом согласен»). Решения по ходу исполнения — в
[`../../decision-log.md`](../../decision-log.md).

## 1. Где мы сейчас — честно

Продукт работает: CLI v0.9.9 в npm, сайт живой, профиль владельца $8.7k /
9.25B токенов, PROFIT-блок «21.9×» — сильнейший скриншот в нише. Но **событие
Fable 5 идёт (1–7 июля, сегодня день 2), а его борд — 404 в проде**: вся фича
(CLI 0.9.11 + Convex-схема + `/leaderboard/fable-5`) лежит незакоммиченным
WIP Codex в грязном worktree, страница untracked. Новостное окно идеальное:
Fable 5 вернулась 1 июля после 19 дней оффлайна, лимит Anthropic 50% истекает
7 июля. Конкуренты: viberank (896 юзеров, $3.3M) публично сгорел на накрутке —
ниша «verified + receipts» открыта; claudecount (X-OAuth) мёртв.

Ловушки доверия: копирайты врут «server recomputes the $» (сервер — dumb
store), `machineLabel = os.hostname()` уходит в паблик при обещании «only
numbers leave your machine», ноль тестов на денежную математику, LiteLLM
не запинен на commit SHA при клейме «pinned rates».

## 2. Событие Fable 5 (окно 1–7 июля)

### Ship day (2 июля, первые ~6 часов)

1. **Проверить, какой Convex-деплоймент прод** (`.env.local` указывает dev
   `chatty-boar-479`, `NEXT_PUBLIC_CONVEX_URL` — `gallant-wildcat-346`).
   Пуш схемы не туда = 500 на publish в день лонча.
2. **Разобрать WIP Codex** на ship / revert / hold (см. §5, этап 0).
3. Пре-деплойные фиксы (≤1.5ч, в тот же слайс):
   - `isFable5ModelId` не ловит `anthropic.claude-fable-5-*`
     (Bedrock/Vertex → $0);
   - 120-дневный срез в `web/convex/http.ts:190,201` держит **старейшие**
     дни → у тяжёлых юзеров июль выпадает и их авто-флагает suspicious;
     держать свежайшие;
   - **suspicious-гейт $15k — all-time, не window-scoped** → кит с lifetime
     >$15k невидим на event-борде; ломает рекрутинг китов (топ viberank $80k);
   - `machineLabel` → generic/hash (сырой hostname — самый цитируемый данк);
   - вернуть RU-профанити-лист в ник-модерацию (Codex выпилил зря);
   - **OG-image для `/leaderboard/fable-5`** с **empty-state** (публикации
     1–2 июля не считаются — нужен `dailyModelSpend` из CLI ≥0.9.10; борд в
     момент деплоя пуст). OG НЕ ждёт rank-in-publish-response — ложная
     зависимость;
   - **paste-ready share-строка в CLI 0.9.11 — сегодня, не 0.9.12**: готовый
     твит с числами + `x.com/intent` после `Done! Your page:`
     (`cli/bin/tokmax.mjs:826`). Пик запусков — волна re-run; второго re-run
     за неделю не будет.
4. Деплой строго: **Convex prod → Vercel → `npm publish` 0.9.11**.
5. `GLOBAL_DAILY_CAP` 5000 → ~20k (`web/convex/lib/tmx.ts:248`) — иначе
   rate-limit платформы на пике.
6. Владелец: `npx tokmax` на обеих машинах → launch-тред.

### Launch-тред (EN, @shilovtech)

```text
1/ Fable 5 is back after 19 days offline. Anthropic capped it at 50% of your
   weekly limit through July 7. So we built a scoreboard: who can burn the
   most anyway. Live board, 5 days left → [link]
2/ 30 seconds to enter: npx tokmax → sign in with X → publish. Your rank
   links to your X profile — climbing the board earns followers.
3/ Privacy: only aggregates leave your machine — token counts, days, dollars.
   No prompts, no file paths. Open source — read the code. [repo]
4/ Counting: ccusage methodology, deduped. Pricing: LiteLLM rates, computed
   locally by open-source code. The $ is API-equivalent — we know you're on
   Max. That's the point.
5/ Prizes: #1 verified gets pinned on this account through July + Launch
   Champion on their profile. Verified only — verification is the anti-cheat.
6/ #1 right now is $___. That will not survive the day. [board]
```

Отдельным постом — свой флекс со скриншотом PROFIT-блока (самодоксинг первым
легитимизирует чужие). Бейджей как фичи нет — «Launch Champion» вешаем руками,
«permanent» не обещать, пока фича не существует.

### Контент 3–8 июля (минимальный дневной комплект для соло)

Обязательный минимум: один standings-пост в день + ответы на прямые
упоминания. Реплаи на X-поиск "Fable 5" («put it on the board: `npx tokmax`»)
— сколько успеется, режется первым.

- **Jul 3** — standings + теги лидеров (их RT) + poll «rationing /
  tokenmaxing anyway / back on Opus / API key».
- **Jul 4** — meme «burning tokens, not fireworks 🎆» + feature-drop.
- **Jul 5** — controversy: «The board isn't the waste — the board is the
  receipt» (злые quote-RT несут ссылку).
- **Jul 6** — displacement bait: «@#2 is $[gap] behind @#1 with 36h left».
- **Jul 7** — AM «FINAL DAY», PM «⚠️ Days are UTC. The board only counts what
  you PUBLISH — re-run before 23:59 UTC». **Механики заморозки нет** — фильтр
  date-based: publish 8–9 июля с июльскими днями двигает борд задним числом.
  До 7-го решить: publish-time cutoff / снапшот «final as of…» / честная
  формулировка. 7-го вечером — только тизер.
- **Jul 8 утром, по закрытию окна** — wrapped-тред (закрепить): победитель,
  top-10 с тегами, weird stats, тег @AnthropicAI без просьб, closer «Every
  major model launch gets a launch-week board».

Рекрутинг китов: Geoffrey Huntley (флексер бордов), тяжёлые CC-постеры;
Simon Willison — его $110.42 был 9 июня, **вне окна** → фрейм «do it again
this week», не «you're already top 3» (tokmax не имеет данных, пока человек
сам не запустил CLI). Всегда «claim your handle», никогда «please promote».

## 3. Продукт по фронтам (топ-5 на фронт, ranked)

**CLI**: 1) scan-first flow — $ до вопросов про identity; `tokmax stats`
local-only (week); 2) фикс daily-job npx-cache-path — молча дохнет, борд
протухает; обёртка `npx -y tokmax@latest publish` (week, retention-критично);
3) screenshot-grade terminal card (week/next); 4) Codex-дедуп + маркер
«estimated» на fallback-прайсинг + `[1m]` long-context premium (next);
5) адаптеры Gemini CLI / OpenCode / Amp — ~100 LOC каждый = отдельный
анонс-пост (next). Плюс: device-code/SSH-фоллбек логина (README продаёт
«laptop and server», X-логин по SSH сломан — loopback на remote, тихий
таймаут; минимум подсказка anon `--key`); мелочи: `--since all` сломан при
персистентном триме, `--dry-run` мутирует prefs.

**Web**: 1) OG-images fable-5/leaderboard/лендинг (week); 2) countdown +
медали + follow-back `x.com/{nick}` + share-intent (week); 3) ISR 30–60s на
борды + rank-чип без fetch top-200 (week/next); 4) `modelSpend`-рендер,
Fable-5 блок профиля, streaks/Δ-rank (next); 5) SEO-пакет: снять `noindex`
с профилей (убивает long-tail), favicon, sitemap, robots, ItemList JSON-LD
(next). Later: мёртвый CSS (~70% globals.css), общий header, mobile.

**Backend + анти-чит**: 1) server-side plausibility recompute (токены ×
серверная прайс-таблица → флаг при расхождении) — закрывает «curl $14,900» и
делает клейм честным (week/next-первым); 2) verified-only событийный борд +
ручной обзор top-10 ежедневно (week, политика, 0 кода); 3) XFF-append +
`TMX_IP_SALT` в проде (week, минуты); 4) throttling фейлов publish/xAuth
(сейчас cost-DoS бесплатен) + шардинг `ops_tmx_counters` (next); 5) полнота
удаления (purge по `x_user_id`) + прекомпьют агрегатов вместо 1000-doc
скана (next).

**Docs + маркетинг**: 1) **P0, блокирует постинг**: убить «server recomputes»
во всех ассетах, освежить числа, честный payload + дисклоуз plan-детекции
(week); 2) event-контент: standings, winner, wrapped (week); 3) docs-gutting
Codex: канон **архивировать, не удалять** — findings-log это HN-защита
математики (week); 4) запинить LiteLLM commit SHA + PROFIT/× methodology
(rolling-30, staleness цен, elasticity caveat) + PH gallery assets — папка
пуста, без них PH-лонч невозможен (next); 5) метрики/воронка + event-runbook
как reusable формат (next).

**Тесты (сквозное, next)**: ноль тестов на арифметику публичного борда —
aggregate, pricing, Codex-сплит, дедуп, window-math. «Unaudited numbers» —
самый дешёвый данк; единственная страховка при добавлении адаптеров.

## 4. Стратегия

**Позиция: «verified token-burn scoreboard — X-identity, receipts, event
boards»**, не «ещё один спенд-трекер». Три клейма: verified люди (ранг =
follower faucet); PROFIT/× переворачивает «wasteful» в value-hack; receipts
(open source, dated windows, per-model) — клейм должен стать правдой
(recompute). «Каждый запуск модели = launch-week board» — франшиза, которой
нет ни у кого.

**Retention**: `daily on` — единственная механика, и она сломана (npx-path);
фикс важнее любой новой фичи. Месячные сезоны + winner-пост 1-го числа;
streaks (данные в `daily[]` есть).

**Метрики**: north star — **Weekly Active Publishers**. Supporting:
% verified среди WAP; npm downloads → first publish; `daily on` adoption /
stale-rate. Анти-метрика: сырой «$X tracked» (у viberank надут фродом).

**Риски**: фрод-скандал mid-event (митигация: verified-policy + recompute +
ручной обзор + заготовленный transparency-пост); Anthropic-оптика («measure
what you got», не «drain your limits»; постить и Codex-цифры); privacy-данки
(hostname, plan-детекция) — фиксить до приглашения к аудиту.

**Что НЕ делать**: HN/PH/Reddit в event-неделю (Show HN после 7-го с данными
недели); cash/crypto-призы (переводят фрод из эго в деньги; максимум месяц
Max); адаптеры в event-неделю; кросс-селл RU-курса на tokmax; расширение
X-scope за пределы read.

## 5. Порядок работ

- **Этап 0 (блокирует всё)**: WIP Codex разрезать, не мержить блобом:
  **(a) ship** — Fable-5 vertical slice (cli pricing/payload, convex
  schema/http/tables, `tmx-profile-live.ts`, untracked-страница — `git add`
  немедленно) + пре-фиксы §2; **(b) revert** — выпил RU-профанити-листа;
  **(c) hold** — docs-gutting + удаление AGENTS.md → отдельно, решение
  владельца, канон в архив. Слайс (a) заодно молча выпиливает RU-комменты
  HARDENING/P0-обоснований в коде — rationale зафиксировать в decision-log
  тем же заходом. Деплой: verify prod → Convex → Vercel → npm.
- **Этап 1 (сегодня)**: оба `npx tokmax` владельца → launch-тред → cap ↑.
- **Этап 2 (24ч)**: countdown/медали → share-intent → follow-back → CLI rank
  → честный копирайт. Порезано из недели: podium-карточки с X-follow
  иконками, полировка профильного OG → после ивента.
- **Этап 3 (48ч)**: daily-job fix → ISR → XFF/`TMX_IP_SALT` → reserved nicks
  (~20 известных хэндлов, **с исключением для verified-владельца хэндла** —
  иначе запираем дверь перед теми, кого зовём) → landing-баннер → решение по
  freeze-механике. Параллельно контент-минимум.
- **Этап 4 (доверие)**: recompute → verified-policy → ручной обзор top-10.
- **Этап 5 (с 8 июля)**: wrapped → тесты денежной математики + CI → Show HN
  → адаптеры по одному → методология + PH-ассеты → сезоны/streaks.

Зависимости: всё висит на этапе 0; постинг ссылок — на OG + честном
копирайте; Show HN — на recompute; адаптеры — на тестах.
