import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tmxDailyFields, tmxModelUsageFields, tmxSourceFields, tmxTotalsFields } from './lib/tmx'

// tokenmax (L2) — ISOLATED deployment. Эта схема содержит ТОЛЬКО tmx-таблицы:
// никакой платёжки/клиентов/email из основного сайта. Префикс tmx_ — короткий
// код таблиц (не бренд-слово). Канон зон data_/ops_ — docs/2-product/db/README.md.

export default defineSchema({
  // Сырьё публикаций ника: каждая публикация = иммутабельный атом (write-once).
  // ipHash — солёный хеш, не сырой IP (152-ФЗ: не-ПД), только для эфемерного
  // rate-limit. costUsd приходит от клиента (CLI: LiteLLM + наша формула);
  // сервер только хранит/показывает; верификация — отдельный отложенный gate.
  data_raw_tmx_submissions: defineTable({
    nick: v.string(),
    ipHash: v.string(),
    cliVersion: v.string(),
    pricingVersion: v.string(),
    machineLabel: v.string(),
    firstDay: v.string(),
    lastDay: v.string(),
    models: v.array(v.object(tmxModelUsageFields)),
    sources: v.array(v.object(tmxSourceFields)),
    daily: v.array(v.object(tmxDailyFields)),
    totals: v.object(tmxTotalsFields),
    costUsd: v.number(),
    suspicious: v.boolean(),
    subscriptionUsd: v.optional(v.number()),
    // "Sign in with X" (web-confidential OAuth2): когда публикация сделана
    // верифицированным X-аккаунтом, тут лежит ИММУТАБЕЛЬНЫЙ x_user_id владельца.
    // Проектор группирует все машины аккаунта по этому ключу (мульти-комп без
    // ручного --key). Legacy-публикации (capability-secret) оставляют поле пустым.
    account_x_user_id: v.optional(v.string()),
    insertedAt: v.number(),
  })
    // HARDENING #4: [nick, insertedAt] — ограниченное чтение проектором
    // (последние N) + per-nick min-interval (последняя публикация ника).
    .index('by_nick_inserted', ['nick', 'insertedAt'])
    // HARDENING #3: [ipHash, insertedAt] — bounded rate-limit окном времени,
    // вместо .collect() всей истории IP.
    .index('by_ip_hash_inserted', ['ipHash', 'insertedAt'])
    // X-auth: [account_x_user_id, insertedAt] — проектор читает последние N
    // публикаций аккаунта (все машины) без сканирования всей таблицы.
    .index('by_account_inserted', ['account_x_user_id', 'insertedAt']),

  // Снапшот-проекция профиля на ник (mutable, один ряд = один ник). costUsd и
  // totalTokens продублированы топ-уровнем для индекса leaderboard (V1).
  data_cooked_tmx_profiles: defineTable({
    nick: v.string(),
    firstDay: v.string(),
    lastDay: v.string(),
    machineLabels: v.array(v.string()),
    sources: v.array(v.object(tmxSourceFields)),
    daily: v.array(v.object(tmxDailyFields)),
    totals: v.object(tmxTotalsFields),
    costUsd: v.number(),
    totalTokens: v.number(),
    submissionCount: v.number(),
    cliVersion: v.string(),
    suspicious: v.boolean(),
    subscriptionUsd: v.optional(v.number()),
    // X-auth: профиль ника, собранный из публикаций верифицированного аккаунта.
    // Пусто для legacy-профилей (capability-secret).
    account_x_user_id: v.optional(v.string()),
    firstSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_nick', ['nick'])
    .index('by_cost_usd', ['costUsd'])
    // Лидерборд читает только видимые профили: eq('suspicious', false) на уровне
    // индекса, чтобы suspicious-кластер (высокий costUsd) не вытеснял легитимные
    // строки из bounded take-окна (filter-after-take = DoS лидерборда).
    .index('by_suspicious_cost', ['suspicious', 'costUsd'])
    .index('by_updated_at', ['updatedAt']),

  // "Sign in with X": верифицированный аккаунт. Ключ — ИММУТАБЕЛЬНЫЙ x_user_id;
  // handle/name/avatar_url — mutable display (обновляются на каждом логине).
  // X access-токены тут НЕ хранятся (offline.access не запрашиваем — identity
  // читается один раз при логине). token_hash — DEPRECATED: account-токены
  // теперь живут в biz_tmx_account_tokens (по одному на машину), чтобы вход со
  // второй машины не инвалидировал первую. Поле оставлено nullable для
  // обратной совместимости и больше не читается/не пишется со смыслом.
  biz_tmx_accounts: defineTable({
    x_user_id: v.string(),
    handle: v.string(),
    name: v.string(),
    avatar_url: v.string(),
    // DEPRECATED (см. biz_tmx_account_tokens) — всегда null.
    token_hash: v.union(v.string(), v.null()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index('by_x_user_id', ['x_user_id'])
    // P2 legacy-downgrade: быстрый ответ «занят ли ник верифицированным
    // аккаунтом» при анонимной (legacy) публикации.
    .index('by_handle', ['handle']),

  // "Sign in with X" — multi-token store: один ряд на залогиненную машину.
  // Минт нового токена (вход с новой машины) ДОБАВЛЯЕТ ряд и НЕ инвалидирует
  // остальные → мульти-комп работает по-настоящему. token_hash — SHA-256 от
  // account-токена (сам токен отдаётся CLI один раз, не хранится). logout
  // удаляет ряд этой машины; logout-all — все ряды аккаунта. machine_label —
  // best-effort метка (hostname), чтобы владелец узнавал устройство.
  biz_tmx_account_tokens: defineTable({
    account_x_user_id: v.string(),
    token_hash: v.string(),
    machine_label: v.union(v.string(), v.null()),
    created_at: v.number(),
    last_used_at: v.number(),
  })
    .index('by_token_hash', ['token_hash'])
    .index('by_account', ['account_x_user_id']),

  // "Sign in with X": короткоживущая OAuth2-сессия (state + PKCE). Создаётся в
  // begin, потребляется один раз в complete (CSRF/replay-защита), затем держит
  // одноразовый exchange_code (TTL 30s) для loopback-обмена CLI. Все секреты
  // (code_verifier, exchange_code_hash, redeem_secret_hash) server-side; наружу
  // не уходят. redeem_secret_hash — PKCE-style доказательство владения для
  // redeem: CLI генерит высокоэнтропийный redeem_secret, сюда кладётся ТОЛЬКО
  // его SHA-256; сам секрет никогда не попадает в URL (ни в loopback-redirect,
  // ни куда-либо) и предъявляется server-to-server при redeem. Поэтому утёкший
  // loopback-URL (один exchange_code) бесполезен — это закрывает кражу токена
  // через перехват loopback-URL (RFC 8252 PKCE-эквивалент для redeem-шага).
  data_raw_tmx_auth_sessions: defineTable({
    state: v.string(),
    code_verifier: v.string(),
    port: v.number(),
    redeem_secret_hash: v.string(),
    exchange_code_hash: v.union(v.string(), v.null()),
    account_x_user_id: v.union(v.string(), v.null()),
    used: v.boolean(),
    created_at: v.number(),
    expires_at: v.number(),
  })
    .index('by_state', ['state'])
    .index('by_exchange_code_hash', ['exchange_code_hash'])
    // Крон-уборка протухших сессий — bounded read по времени истечения.
    .index('by_expires_at', ['expires_at']),

  // Анти-сквоттинг без identity: ник → secret_hash (capability-token). Апдейт
  // ника требует секрета (владение по секрету, не по личности); первая
  // публикация ника создаёт claim. Персональных данных нет.
  ops_tmx_claims: defineTable({
    nick: v.string(),
    secretHash: v.string(),
    createdAt: v.number(),
    lastPublishAt: v.number(),
    publishCount: v.number(),
  }).index('by_nick', ['nick']),

  // HARDENING #2: глобальный circuit-breaker. Один ряд на сутки (UTC, YYYY-MM-DD)
  // со счётчиком успешных публикаций. Жёсткий ceiling (GLOBAL_DAILY_CAP) bounds
  // storage/cost независимо от IP.
  ops_tmx_counters: defineTable({
    day: v.string(),
    count: v.number(),
  }).index('by_day', ['day']),
})
